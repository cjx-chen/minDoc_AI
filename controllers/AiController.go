package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/beego/beego/v2/client/orm"
	"github.com/beego/beego/v2/core/logs"
	"github.com/beego/beego/v2/server/web"
	"github.com/beego/i18n"
	"github.com/mindoc-org/mindoc/conf"
	"github.com/mindoc-org/mindoc/models"
	"github.com/mindoc-org/mindoc/utils/segmenter"
)

type AiController struct {
	BaseController
}

type aiKnowledge struct {
	ChunkId          int     `json:"chunk_id"`
	DocId            int     `json:"doc_id"`
	Title            string  `json:"title"`
	ChunkTitle       string  `json:"chunk_title"`
	BookName         string  `json:"book_name"`
	BookIdentify     string  `json:"book_identify"`
	DocumentIdentify string  `json:"document_identify"`
	Snippet          string  `json:"snippet"`
	SourceUrl        string  `json:"source_url"`
	Score            float64 `json:"score"`
}

type aiChunkCandidate struct {
	ChunkId          int
	DocumentId       int
	BookId           int
	ChunkIndex       int
	ChunkTitle       string
	Content          string
	DocumentName     string
	DocumentIdentify string
	BookName         string
	BookIdentify     string
}

type openAIMessage struct {
	Role             string `json:"role"`
	Content          string `json:"content"`
	ReasoningContent string `json:"reasoning_content,omitempty"`
}

type openAIChatRequest struct {
	Model          string          `json:"model"`
	Messages       []openAIMessage `json:"messages"`
	Temperature    float64         `json:"temperature"`
	MaxTokens      int             `json:"max_tokens"`
	EnableThinking *bool           `json:"enable_thinking,omitempty"`
}

type openAIChatChoice struct {
	Message openAIMessage `json:"message"`
}

type openAIChatResponse struct {
	Choices []openAIChatChoice `json:"choices"`
	Error   struct {
		Message string `json:"message"`
	} `json:"error"`
}

const (
	defaultAIModel             = "gpt-4o-mini"
	defaultAITemperature       = 0.3
	defaultAIMaxTokens         = 1600
	defaultAIContextLength     = 1200
	defaultAIContextTopN       = 8
	defaultAIChunkInitLimit    = 300
	defaultAIChunkScanLimit    = 3000
	defaultAIRequestTimeoutSec = 120
	defaultAIRestEndpoint      = "https://api.openai.com/v1/chat/completions"
)

func (c *AiController) ChatPage() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.Redirect(conf.URLFor("AccountController.Login")+"?url="+url.PathEscape(conf.BaseUrl+c.Ctx.Request.URL.RequestURI()), 302)
		return
	}

	c.Data["BaseUrl"] = c.BaseUrl()
	c.Data["AIEnabled"] = isAIEnabled()
	c.Data["AIModel"] = getAIModel()
	c.Data["AIQuestionPlaceholder"] = "例如：这个文档库里关于部署、数据库或接口是怎么说明的？"
	c.TplName = "ai/chat.tpl"
}

func (c *AiController) Ask() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.JsonResult(401, i18n.Tr(c.Lang, "message.need_relogin"))
		return
	}

	question := strings.TrimSpace(c.GetString("question"))
	if question == "" {
		c.JsonResult(400, "问题不能为空")
		return
	}

	topN := web.AppConfig.DefaultInt("ai_context_top_n", defaultAIContextTopN)
	if topN <= 0 {
		topN = defaultAIContextTopN
	}
	if topN > 16 {
		topN = 16
	}

	knowledge, err := c.gatherKnowledge(question, topN)
	if err != nil {
		logs.Error("AI knowledge retrieval failed -> ", err)
		c.JsonResult(500, "知识库检索失败")
		return
	}

	answer, mode := "", "fallback"
	aiErrMessage := ""
	if len(knowledge) == 0 {
		answer = "当前知识库分片中没有检索到足够相关的内容，暂时无法基于知识库回答。"
	} else if isAIEnabled() {
		answer, err = c.requestLLMAnswer(question, knowledge)
		if err != nil {
			logs.Error("AI provider failed, fallback to retrieval summary -> ", err)
			aiErrMessage = err.Error()
			answer = c.buildFallbackAnswer(question, knowledge, aiErrMessage)
		} else {
			mode = "llm"
		}
	} else {
		answer = c.buildFallbackAnswer(question, knowledge, "")
	}

	c.JsonResult(0, "OK", map[string]interface{}{
		"question": question,
		"answer":   answer,
		"mode":     mode,
		"ai_error": aiErrMessage,
		"sources":  knowledge,
		"models": map[string]interface{}{
			"enabled": isAIEnabled(),
			"model":   getAIModel(),
		},
		"total": len(knowledge),
	})
}

func (c *AiController) gatherKnowledge(question string, topN int) ([]aiKnowledge, error) {
	initLimit := web.AppConfig.DefaultInt("ai_chunk_init_limit", defaultAIChunkInitLimit)
	if initLimit <= 0 {
		initLimit = defaultAIChunkInitLimit
	}
	if err := models.InitializeMissingAIKnowledgeChunks(initLimit); err != nil {
		return nil, err
	}

	candidates, err := c.loadReadableChunkCandidates()
	if err != nil {
		return nil, err
	}

	terms := normalizeAITerms(segmenter.Segment(question), question)
	scored := make([]aiKnowledge, 0)
	contextLength := getAIContextLength()

	for _, chunk := range candidates {
		score := scoreChunkCandidate(question, terms, chunk)
		if score <= 0 {
			continue
		}
		scored = append(scored, c.buildKnowledgeItem(chunk, score, contextLength))
	}

	sort.Slice(scored, func(i, j int) bool {
		if scored[i].Score != scored[j].Score {
			return scored[i].Score > scored[j].Score
		}
		if scored[i].DocId != scored[j].DocId {
			return scored[i].DocId < scored[j].DocId
		}
		return scored[i].ChunkId < scored[j].ChunkId
	})

	if len(scored) > topN {
		scored = scored[:topN]
	}
	return scored, nil
}

func (c *AiController) loadReadableChunkCandidates() ([]aiChunkCandidate, error) {
	o := orm.NewOrm()
	chunkTable := models.NewAIKnowledgeChunk().TableNameWithPrefix()
	docTable := models.NewDocument().TableNameWithPrefix()
	bookTable := models.NewBook().TableNameWithPrefix()

	scanLimit := web.AppConfig.DefaultInt("ai_chunk_scan_limit", defaultAIChunkScanLimit)
	if scanLimit <= 0 {
		scanLimit = defaultAIChunkScanLimit
	}

	fields := "c.chunk_id, c.document_id, c.book_id, c.chunk_index, c.chunk_title, c.content, d.document_name, d.identify AS document_identify, b.book_name, b.identify AS book_identify"
	baseSQL := "SELECT " + fields + " FROM " + chunkTable + " c INNER JOIN " + docTable + " d ON c.document_id = d.document_id INNER JOIN " + bookTable + " b ON c.book_id = b.book_id WHERE b.status = 0 AND c.content <> ''"

	var rows []aiChunkCandidate
	if c.Member != nil && c.Member.IsAdministrator() {
		_, err := o.Raw(baseSQL+" ORDER BY c.modify_time DESC LIMIT ?", scanLimit).QueryRows(&rows)
		return rows, err
	}

	if c.Member == nil || c.Member.MemberId <= 0 {
		_, err := o.Raw(baseSQL+" AND b.privately_owned = 0 ORDER BY c.modify_time DESC LIMIT ?", scanLimit).QueryRows(&rows)
		return rows, err
	}

	relationshipTable := models.NewRelationship().TableNameWithPrefix()
	sql := baseSQL + " AND (b.privately_owned = 0 OR EXISTS (SELECT 1 FROM " + relationshipTable + " r WHERE r.book_id = b.book_id AND r.member_id = ?)) ORDER BY c.modify_time DESC LIMIT ?"
	_, err := o.Raw(sql, c.Member.MemberId, scanLimit).QueryRows(&rows)
	return rows, err
}

func (c *AiController) buildKnowledgeItem(chunk aiChunkCandidate, score float64, contextLength int) aiKnowledge {
	documentIdentify := chunk.DocumentIdentify
	if documentIdentify == "" {
		documentIdentify = strconv.Itoa(chunk.DocumentId)
	}

	chunkTitle := strings.TrimSpace(chunk.ChunkTitle)
	title := chunk.DocumentName
	if chunkTitle != "" && chunkTitle != chunk.DocumentName {
		title = chunk.DocumentName + " / " + chunkTitle
	}

	return aiKnowledge{
		ChunkId:          chunk.ChunkId,
		DocId:            chunk.DocumentId,
		Title:            title,
		ChunkTitle:       chunkTitle,
		BookName:         chunk.BookName,
		BookIdentify:     chunk.BookIdentify,
		DocumentIdentify: documentIdentify,
		Snippet:          truncateForAI(chunk.Content, contextLength),
		SourceUrl:        c.buildDocumentSourceURL(chunk.BookIdentify, documentIdentify),
		Score:            score,
	}
}

func (c *AiController) buildFallbackAnswer(question string, knowledge []aiKnowledge, aiErrMessage string) string {
	if len(knowledge) == 0 {
		return "我没有在 MinDoc 知识库分片中找到与问题相关的内容。"
	}

	var b strings.Builder
	if aiErrMessage != "" {
		b.WriteString("AI 调用错误：")
		b.WriteString(aiErrMessage)
		b.WriteString("\n\n")
	}
	b.WriteString("已从 MinDoc 知识库分片中检索到以下相关内容，但当前没有成功调用模型生成答案：\n\n")
	b.WriteString("问题：")
	b.WriteString(question)
	b.WriteString("\n\n")
	for index, item := range knowledge {
		b.WriteString(fmt.Sprintf("[%d] %s / %s\n", index+1, item.BookName, item.Title))
		b.WriteString("来源：")
		b.WriteString(item.SourceUrl)
		b.WriteString("\n内容：")
		b.WriteString(item.Snippet)
		b.WriteString("\n\n")
	}
	return b.String()
}

func (c *AiController) requestLLMAnswer(question string, knowledge []aiKnowledge) (string, error) {
	apiKey := getAIAPIKey()
	if apiKey == "" {
		return "", fmt.Errorf("AI API key is not configured")
	}

	var contextBuilder strings.Builder
	for index, item := range knowledge {
		contextBuilder.WriteString(fmt.Sprintf("[%d] %s / %s\n", index+1, item.BookName, item.Title))
		contextBuilder.WriteString("来源：")
		contextBuilder.WriteString(item.SourceUrl)
		contextBuilder.WriteString("\n分片内容：")
		contextBuilder.WriteString(item.Snippet)
		contextBuilder.WriteString("\n\n")
	}

	systemPrompt := getAISystemPrompt()
	userPrompt := "用户问题：\n" + question + "\n\nMinDoc 知识库分片：\n" + contextBuilder.String() +
		"\n请只基于以上知识库分片回答。优先使用排名靠前的分片，回答要准确、简洁，并在关键结论后标注来源编号，例如 [1]。如果分片资料不足，请明确说明知识库中缺少依据。"

	body := openAIChatRequest{
		Model: getAIModel(),
		Messages: []openAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature:    getAITemperature(),
		MaxTokens:      getAIMaxTokens(),
		EnableThinking: getAIEnableThinking(),
	}

	payload, err := json.Marshal(&body)
	if err != nil {
		return "", err
	}

	request, err := http.NewRequestWithContext(context.Background(), http.MethodPost, getAIEndpoint(), bytes.NewBuffer(payload))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: getAIRequestTimeout()}
	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer func() { _ = response.Body.Close() }()

	raw, err := io.ReadAll(response.Body)
	if err != nil {
		return "", err
	}

	var result openAIChatResponse
	parseErr := json.Unmarshal(raw, &result)
	if response.StatusCode != http.StatusOK {
		msg := fmt.Sprintf("AI provider returned HTTP %d", response.StatusCode)
		if parseErr == nil && result.Error.Message != "" {
			msg += ": " + result.Error.Message
		} else if rawBody := strings.TrimSpace(string(raw)); rawBody != "" {
			msg += ": " + truncateForAI(rawBody, 1000)
		}
		return "", fmt.Errorf("%s", msg)
	}
	if parseErr != nil {
		return "", parseErr
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("AI provider returned no choices")
	}

	content := strings.TrimSpace(result.Choices[0].Message.Content)
	if content == "" {
		content = strings.TrimSpace(result.Choices[0].Message.ReasoningContent)
	}
	if content == "" {
		return "", fmt.Errorf("AI provider returned empty content")
	}
	return content, nil
}

func normalizeAITerms(words []string, question string) []string {
	result := make([]string, 0, len(words)+1)
	seen := make(map[string]bool)
	for _, word := range words {
		word = strings.ToLower(strings.TrimSpace(word))
		if word == "" || seen[word] {
			continue
		}
		seen[word] = true
		result = append(result, word)
	}
	question = strings.ToLower(strings.TrimSpace(question))
	if question != "" && utf8.RuneCountInString(question) <= 64 && !seen[question] {
		result = append(result, question)
	}
	return result
}

func scoreChunkCandidate(question string, terms []string, chunk aiChunkCandidate) float64 {
	lowerQuestion := strings.ToLower(strings.TrimSpace(question))
	lowerTitle := strings.ToLower(chunk.DocumentName + " " + chunk.ChunkTitle)
	lowerContent := strings.ToLower(chunk.Content)

	score := 0.0
	hits := 0
	for _, term := range terms {
		if term == "" {
			continue
		}
		termLen := float64(utf8.RuneCountInString(term))
		if strings.Contains(lowerTitle, term) {
			score += 8 + termLen
			hits++
		}
		if strings.Contains(lowerContent, term) {
			score += 2 + termLen/2
			hits++
		}
	}

	if lowerQuestion != "" && strings.Contains(lowerContent, lowerQuestion) {
		score += 20
	}
	if len(terms) > 0 {
		score *= 1 + float64(hits)/float64(len(terms))*0.5
	}
	return score
}

func (c *AiController) buildDocumentSourceURL(bookIdentify, documentIdentify string) string {
	base := strings.TrimRight(c.BaseUrl(), "/")
	if base == "" {
		base = conf.BaseUrl
	}
	if base == "" {
		base = "/"
	}
	if bookIdentify == "" {
		return base + "/docs/" + documentIdentify
	}
	return fmt.Sprintf("%s/docs/%s/%s", base, bookIdentify, documentIdentify)
}

func truncateForAI(input string, max int) string {
	text := strings.TrimSpace(input)
	if max <= 0 {
		return text
	}
	runes := []rune(text)
	if len(runes) <= max {
		return text
	}
	return string(runes[:max]) + "..."
}

func isAIEnabled() bool {
	return web.AppConfig.DefaultBool("enable_ai_chat", false) && getAIAPIKey() != ""
}

func getAIAPIKey() string {
	key := strings.TrimSpace(web.AppConfig.DefaultString("ai_api_key", ""))
	if key != "" {
		return key
	}
	return strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
}

func getAIModel() string {
	model := strings.TrimSpace(web.AppConfig.DefaultString("ai_model", defaultAIModel))
	if model == "" {
		return defaultAIModel
	}
	return model
}

func getAIEndpoint() string {
	endpoint := strings.TrimSpace(web.AppConfig.DefaultString("ai_endpoint", defaultAIRestEndpoint))
	if endpoint == "" {
		return defaultAIRestEndpoint
	}
	if !strings.Contains(endpoint, "/chat/completions") {
		endpoint = strings.TrimRight(endpoint, "/") + "/chat/completions"
	}
	return endpoint
}

func getAITemperature() float64 {
	raw := strings.TrimSpace(web.AppConfig.DefaultString("ai_temperature", ""))
	if raw == "" {
		return defaultAITemperature
	}
	temperature, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return defaultAITemperature
	}
	return temperature
}

func getAIMaxTokens() int {
	maxTokens := web.AppConfig.DefaultInt("ai_max_tokens", defaultAIMaxTokens)
	if maxTokens <= 0 {
		return defaultAIMaxTokens
	}
	return maxTokens
}

func getAIRequestTimeout() time.Duration {
	timeout := web.AppConfig.DefaultInt("ai_request_timeout", defaultAIRequestTimeoutSec)
	if timeout <= 0 {
		timeout = defaultAIRequestTimeoutSec
	}
	return time.Duration(timeout) * time.Second
}

func getAIEnableThinking() *bool {
	raw := strings.TrimSpace(web.AppConfig.DefaultString("ai_enable_thinking", ""))
	if raw == "" {
		return nil
	}
	enabled, err := strconv.ParseBool(raw)
	if err != nil {
		return nil
	}
	return &enabled
}

func getAIContextLength() int {
	length := web.AppConfig.DefaultInt("ai_context_length", defaultAIContextLength)
	if length <= 0 {
		return defaultAIContextLength
	}
	return length
}

func getAISystemPrompt() string {
	systemPrompt := strings.TrimSpace(web.AppConfig.DefaultString("ai_system_prompt", ""))
	if systemPrompt != "" {
		return systemPrompt
	}
	return "你是一个只服务于 MinDoc 文档库的知识问答助手。你必须基于提供的知识库分片回答，不能编造知识库之外的信息。"
}
