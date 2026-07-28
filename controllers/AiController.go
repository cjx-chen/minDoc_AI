package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"
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
	ContentMd5       string
	DocumentName     string
	DocumentIdentify string
	BookName         string
	BookIdentify     string
}

type aiBookOption struct {
	BookId   int    `orm:"column(book_id)"`
	BookName string `orm:"column(book_name)"`
	Identify string `orm:"column(identify)"`
}

type aiScoredChunk struct {
	Chunk aiChunkCandidate
	Score float64
}

type aiChunkCacheItem struct {
	Items    []aiChunkCandidate
	ExpireAt time.Time
}

var aiChunkCache = struct {
	sync.RWMutex
	Items map[string]aiChunkCacheItem
}{
	Items: make(map[string]aiChunkCacheItem),
}

type openAIMessage struct {
	Role             string `json:"role"`
	Content          string `json:"content"`
	ReasoningContent string `json:"reasoning_content,omitempty"`
}

type aiChatRequest struct {
	Model          string            `json:"model"`
	Messages       []openAIMessage   `json:"messages"`
	Stream         *bool             `json:"stream,omitempty"`
	Temperature    *float64          `json:"temperature,omitempty"`
	MaxTokens      *int              `json:"max_tokens,omitempty"`
	EnableThinking *bool             `json:"enable_thinking,omitempty"`
	Telemetry      map[string]string `json:"telemetry,omitempty"`
}

type openAIChatChoice struct {
	Message openAIMessage `json:"message"`
	Text    string        `json:"text,omitempty"`
}

type openAIChatResponse struct {
	Choices []openAIChatChoice `json:"choices"`
	Error   struct {
		Message string `json:"message"`
	} `json:"error"`
}

type aiEmbeddingRequest struct {
	Model string      `json:"model"`
	Input interface{} `json:"input"`
}

type aiCodeWikiRequest struct {
	RepoURL     string          `json:"repo_url"`
	CNBURL      string          `json:"cnb_url,omitempty"`
	CNBUsername string          `json:"cnb_username,omitempty"`
	CNBToken    string          `json:"cnb_token,omitempty"`
	Type        string          `json:"type"`
	Messages    []openAIMessage `json:"messages"`
	Provider    string          `json:"provider"`
	Model       string          `json:"model"`
	Language    string          `json:"language"`
}

type aiCodeWikiRepoOption struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type aiCodeWikiRepoAddPayload struct {
	CNBURL      string `json:"cnb_url"`
	CNBUsername string `json:"cnb_username"`
	CNBToken    string `json:"cnb_token"`
}

type aiEmbeddingData struct {
	Index     int       `json:"index"`
	Embedding []float64 `json:"embedding"`
}

type aiEmbeddingResponse struct {
	Data  []aiEmbeddingData `json:"data"`
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}

type aiStoredEmbedding struct {
	ChunkId        int    `orm:"column(chunk_id)"`
	ContentMd5     string `orm:"column(content_md5)"`
	EmbeddingModel string `orm:"column(embedding_model)"`
	EmbeddingDim   int    `orm:"column(embedding_dim)"`
	Embedding      string `orm:"column(embedding)"`
}

type aiEmbeddingStats struct {
	Enabled        bool   `json:"enabled"`
	Model          string `json:"model"`
	QueryCalled    bool   `json:"query_called"`
	BackfillCalled bool   `json:"backfill_called"`
	Candidates     int    `json:"candidates"`
	Stored         int    `json:"stored"`
	Backfilled     int    `json:"backfilled"`
	Matched        int    `json:"matched"`
	ElapsedMS      int64  `json:"elapsed_ms"`
	Error          string `json:"error,omitempty"`
}

const (
	defaultAIModel                  = "gpt-4o-mini"
	defaultAITemperature            = 0.3
	defaultAIMaxTokens              = 1600
	defaultAIContextLength          = 1200
	defaultAIContextTopN            = 8
	defaultAIChunkInitLimit         = 300
	defaultAIChunkScanLimit         = 3000
	defaultAISQLPrefilterTerms      = 12
	defaultAIChunkCacheTTL          = 300
	defaultAIRequestTimeoutSec      = 120
	defaultAIRestEndpoint           = "https://api.openai.com/v1/chat/completions"
	defaultAIRequestProfile         = "openai"
	defaultAIAuthHeader             = "Authorization"
	defaultAIAuthPrefix             = "Bearer "
	defaultAIAgentModelName         = "bocai-agent"
	defaultAICodeWikiModelName      = "code wiki"
	defaultAICodeWikiEndpoint       = "http://22.10.124.20:8001/chat/completions/stream"
	defaultAICodeWikiProvider       = "openai"
	defaultAICodeWikiModel          = "Cot-quick"
	defaultAICodeWikiLanguage       = "zh"
	defaultAICodeWikiType           = "local"
	defaultAIEmbeddingBatchSize     = 8
	defaultAIEmbeddingBackfillLimit = 32
	defaultAIEmbeddingTextLength    = 1200
	defaultAIEmbeddingScoreWeight   = 18.0
)

func (c *AiController) ChatPage() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.Redirect(conf.URLFor("AccountController.Login")+"?url="+url.PathEscape(conf.BaseUrl+c.Ctx.Request.URL.RequestURI()), 302)
		return
	}

	c.Data["BaseUrl"] = c.BaseUrl()
	c.Data["AIEnabled"] = isAIEnabled() || isAIAgentConfigured() || getAICodeWikiAPIKey() != ""
	c.Data["AIModel"] = getAIModel()
	c.Data["AIModelOptions"] = getAIModelOptions()
	c.Data["AIEmbeddingEnabled"] = isAIEmbeddingEnabled()
	c.Data["AIEmbeddingAvailable"] = isAIEmbeddingConfigured()
	c.Data["AICodeWikiRepoURL"] = getAICodeWikiDefaultRepoURL()
	c.Data["AIEmbedded"] = c.GetString("embedded") == "1"
	c.Data["AIBookOptions"] = c.loadReadableBookOptions()
	c.Data["AIQuestionPlaceholder"] = "Ask a question about this MinDoc knowledge base..."
	c.TplName = "ai/chat.tpl"
}

func (c *AiController) CodeWikiRepos() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.JsonResult(401, i18n.Tr(c.Lang, "message.need_relogin"))
		return
	}

	repos, err := c.loadCodeWikiRepoOptions()
	data := map[string]interface{}{
		"repos": repos,
	}
	if err != nil {
		data["error"] = err.Error()
	}
	c.JsonResult(0, "OK", data)
}

func (c *AiController) AddCodeWikiRepo() {
	c.Prepare()
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.JsonResult(401, i18n.Tr(c.Lang, "message.need_relogin"))
		return
	}

	cnbURL := strings.TrimSpace(c.GetString("cnb_url"))
	cnbUsername := strings.TrimSpace(c.GetString("cnb_username"))
	cnbToken := strings.TrimSpace(c.GetString("cnb_token"))
	if cnbURL == "" {
		c.JsonResult(400, "CNB URL is required")
		return
	}

	repo := aiCodeWikiRepoOption{Label: cnbURL, Value: cnbURL}
	if getAICodeWikiRepoAddEndpoint() == "" {
		c.JsonResult(0, "OK", map[string]interface{}{
			"repo":       repo,
			"configured": false,
		})
		return
	}

	raw, statusCode, err := c.doCodeWikiRepoAddRequest(cnbURL, cnbUsername, cnbToken)
	if err != nil {
		c.JsonResult(500, err.Error())
		return
	}
	if statusCode < 200 || statusCode >= 300 {
		if rawBody := strings.TrimSpace(string(raw)); rawBody != "" {
			c.JsonResult(statusCode, fmt.Sprintf("Code Wiki repo add provider returned HTTP %d: %s", statusCode, truncateForAI(rawBody, 500)))
			return
		}
		c.JsonResult(statusCode, fmt.Sprintf("Code Wiki repo add provider returned HTTP %d", statusCode))
		return
	}
	if repos := parseCodeWikiRepoOptions(raw); len(repos) > 0 {
		repo = repos[0]
	}
	c.JsonResult(0, "OK", map[string]interface{}{
		"repo":       repo,
		"configured": true,
	})
}

func (c *AiController) Ask() {
	c.Prepare()
	totalStart := time.Now()
	retrieveMS, llmMS := int64(0), int64(0)
	if !c.EnableAnonymous && !c.isUserLoggedIn() {
		c.JsonResult(401, i18n.Tr(c.Lang, "message.need_relogin"))
		return
	}

	question := strings.TrimSpace(c.GetString("question"))
	if question == "" {
		c.JsonResult(400, "question is required")
		return
	}

	scopeBookIds := parseScopeBookIds(c.GetStrings("book_ids"))
	if len(scopeBookIds) == 0 {
		scopeBookIds = parseScopeBookIds(c.GetStrings("book_ids[]"))
	}
	if len(scopeBookIds) == 0 {
		scopeBookId, _ := c.GetInt("book_id", 0)
		if scopeBookId > 0 {
			scopeBookIds = []int{scopeBookId}
		}
	}

	topN := web.AppConfig.DefaultInt("ai_context_top_n", defaultAIContextTopN)
	if topN <= 0 {
		topN = defaultAIContextTopN
	}
	if topN > 16 {
		topN = 16
	}
	selectedModel := resolveAIModel(c.GetString("model"))
	codeWikiRepoURL := strings.TrimSpace(c.GetString("code_wiki_repo_url"))
	codeWikiCNBURL := strings.TrimSpace(c.GetString("code_wiki_cnb_url"))
	codeWikiCNBUsername := strings.TrimSpace(c.GetString("code_wiki_cnb_username"))
	codeWikiCNBToken := strings.TrimSpace(c.GetString("code_wiki_cnb_token"))
	if codeWikiRepoURL == "" && codeWikiCNBURL != "" {
		codeWikiRepoURL = codeWikiCNBURL
	}
	useEmbedding := parseAIEmbeddingEnabledChoice(c.GetString("embedding_enabled"))
	if isCodeWikiModel(selectedModel) && codeWikiRepoURL == "" {
		c.JsonResult(400, "code wiki repo_url is required")
		return
	}
	var knowledge []aiKnowledge
	var embeddingStats aiEmbeddingStats
	var err error
	if !isCodeWikiModel(selectedModel) {
		retrieveStart := time.Now()
		knowledge, embeddingStats, err = c.gatherKnowledge(question, topN, scopeBookIds, useEmbedding)
		retrieveMS = time.Since(retrieveStart).Milliseconds()
		if err != nil {
			logs.Error("AI knowledge retrieval failed -> ", err)
			c.JsonResult(500, "knowledge retrieval failed")
			return
		}
	}

	answer, mode := "", "fallback"
	aiErrMessage := ""
	if isCodeWikiModel(selectedModel) {
		llmStart := time.Now()
		answer, err = c.requestCodeWikiAnswer(question, codeWikiRepoURL, codeWikiCNBURL, codeWikiCNBUsername, codeWikiCNBToken)
		llmMS = time.Since(llmStart).Milliseconds()
		if err != nil {
			logs.Error("Code Wiki provider failed -> ", err)
			aiErrMessage = err.Error()
			answer = "Code Wiki call failed: " + aiErrMessage
		} else {
			mode = "code_wiki"
		}
	} else if len(knowledge) == 0 {
		answer = "No relevant knowledge chunks were found in the current MinDoc knowledge base, so the answer cannot be generated from the knowledge base."
	} else if isAIAgentModel(selectedModel) {
		llmStart := time.Now()
		answer, err = c.requestAgentAnswer(question, knowledge)
		llmMS = time.Since(llmStart).Milliseconds()
		if err != nil {
			logs.Error("AI agent provider failed, fallback to retrieval summary -> ", err)
			aiErrMessage = err.Error()
			answer = c.buildFallbackAnswer(question, knowledge, aiErrMessage)
		} else {
			mode = "agent"
		}
	} else if isAIEnabled() {
		llmStart := time.Now()
		answer, err = c.requestLLMAnswer(question, knowledge, selectedModel)
		llmMS = time.Since(llmStart).Milliseconds()
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
		"book_ids": scopeBookIds,
		"timing": map[string]int64{
			"retrieve_ms":  retrieveMS,
			"embedding_ms": embeddingStats.ElapsedMS,
			"llm_ms":       llmMS,
			"total_ms":     time.Since(totalStart).Milliseconds(),
		},
		"embedding": embeddingStats,
		"sources":   knowledge,
		"models": map[string]interface{}{
			"enabled":         isAIEnabled(),
			"agent_enabled":   isAIAgentConfigured(),
			"model":           selectedModel,
			"embedding_model": getAIEmbeddingModel(),
		},
		"total": len(knowledge),
	})
}

func (c *AiController) gatherKnowledge(question string, topN int, scopeBookIds []int, useEmbedding bool) ([]aiKnowledge, aiEmbeddingStats, error) {
	embeddingEnabled := useEmbedding
	embeddingStats := aiEmbeddingStats{
		Enabled: embeddingEnabled,
		Model:   getAIEmbeddingModel(),
	}
	initLimit := web.AppConfig.DefaultInt("ai_chunk_init_limit", defaultAIChunkInitLimit)
	if initLimit <= 0 {
		initLimit = defaultAIChunkInitLimit
	}
	if err := models.InitializeMissingAIKnowledgeChunks(initLimit); err != nil {
		return nil, embeddingStats, err
	}

	terms := normalizeAITerms(segmenter.Segment(question), question)
	candidates, err := c.loadReadableChunkCandidates(scopeBookIds, terms)
	if err != nil {
		return nil, embeddingStats, err
	}
	if embeddingEnabled {
		vectorCandidates, vectorErr := c.loadReadableChunkCandidates(scopeBookIds, nil)
		if vectorErr != nil {
			logs.Warn("AI vector candidate loading failed, continue with keyword candidates -> ", vectorErr)
		} else {
			candidates = mergeAIChunkCandidates(candidates, vectorCandidates)
		}
	}
	vectorScores := make(map[int]float64)
	if embeddingEnabled {
		vectorScores, embeddingStats = c.buildAIEmbeddingScores(question, candidates)
	}

	scored := make([]aiScoredChunk, 0)
	contextLength := getAIContextLength()
	if hasCompositionIntent(strings.ToLower(question)) {
		compositionLength := web.AppConfig.DefaultInt("ai_composition_context_length", 2600)
		if compositionLength > contextLength {
			contextLength = compositionLength
		}
	}

	for _, chunk := range candidates {
		score := scoreChunkCandidate(question, terms, chunk)
		if vectorScore := vectorScores[chunk.ChunkId]; vectorScore > 0 {
			score += vectorScore * getAIEmbeddingScoreWeight()
		}
		if score <= 0 {
			continue
		}
		scored = append(scored, aiScoredChunk{Chunk: chunk, Score: score})
	}

	sort.Slice(scored, func(i, j int) bool {
		if scored[i].Score != scored[j].Score {
			return scored[i].Score > scored[j].Score
		}
		if scored[i].Chunk.DocumentId != scored[j].Chunk.DocumentId {
			return scored[i].Chunk.DocumentId < scored[j].Chunk.DocumentId
		}
		if scored[i].Chunk.ChunkIndex != scored[j].Chunk.ChunkIndex {
			return scored[i].Chunk.ChunkIndex < scored[j].Chunk.ChunkIndex
		}
		return scored[i].Chunk.ChunkId < scored[j].Chunk.ChunkId
	})

	expanded := expandRelevantChunks(scored, candidates, topN)
	result := make([]aiKnowledge, 0, len(expanded))
	for _, item := range expanded {
		result = append(result, c.buildKnowledgeItem(item.Chunk, item.Score, contextLength))
	}
	return result, embeddingStats, nil
}

func (c *AiController) loadReadableBookOptions() []aiBookOption {
	o := orm.NewOrm()
	bookTable := models.NewBook().TableNameWithPrefix()
	fields := "b.book_id, b.book_name, b.identify"
	baseSQL := "SELECT " + fields + " FROM " + bookTable + " b WHERE b.status = 0"

	var rows []aiBookOption
	var err error
	if c.Member != nil && c.Member.IsAdministrator() {
		_, err = o.Raw(baseSQL + " ORDER BY b.book_name ASC, b.book_id ASC").QueryRows(&rows)
	} else if c.Member == nil || c.Member.MemberId <= 0 {
		_, err = o.Raw(baseSQL + " AND b.privately_owned = 0 ORDER BY b.book_name ASC, b.book_id ASC").QueryRows(&rows)
	} else {
		relationshipTable := models.NewRelationship().TableNameWithPrefix()
		teamRelationshipTable := models.NewTeamRelationship().TableNameWithPrefix()
		teamMemberTable := models.NewTeamMember().TableNameWithPrefix()
		sql := baseSQL + " AND (b.privately_owned = 0 OR EXISTS (SELECT 1 FROM " + relationshipTable + " r WHERE r.book_id = b.book_id AND r.member_id = ?) OR EXISTS (SELECT 1 FROM " + teamRelationshipTable + " tr INNER JOIN " + teamMemberTable + " tm ON tm.team_id = tr.team_id WHERE tr.book_id = b.book_id AND tm.member_id = ?)) ORDER BY b.book_name ASC, b.book_id ASC"
		_, err = o.Raw(sql, c.Member.MemberId, c.Member.MemberId).QueryRows(&rows)
	}
	if err != nil {
		logs.Error("AI load readable book options failed -> ", err)
		return nil
	}
	return rows
}

func parseScopeBookIds(values []string) []int {
	result := make([]int, 0, len(values))
	seen := make(map[int]bool, len(values))
	for _, value := range values {
		for _, part := range strings.Split(value, ",") {
			id, err := strconv.Atoi(strings.TrimSpace(part))
			if err != nil || id <= 0 || seen[id] {
				continue
			}
			seen[id] = true
			result = append(result, id)
		}
	}
	return result
}

func buildBookScopeSQL(scopeBookIds []int) (string, []interface{}) {
	if len(scopeBookIds) == 0 {
		return "", nil
	}
	placeholders := make([]string, 0, len(scopeBookIds))
	args := make([]interface{}, 0, len(scopeBookIds))
	for _, id := range scopeBookIds {
		if id <= 0 {
			continue
		}
		placeholders = append(placeholders, "?")
		args = append(args, id)
	}
	if len(placeholders) == 0 {
		return "", nil
	}
	return " AND b.book_id IN (" + strings.Join(placeholders, ",") + ")", args
}

func (c *AiController) loadReadableChunkCandidates(scopeBookIds []int, terms []string) ([]aiChunkCandidate, error) {
	scanLimit := web.AppConfig.DefaultInt("ai_chunk_scan_limit", defaultAIChunkScanLimit)
	if scanLimit <= 0 {
		scanLimit = defaultAIChunkScanLimit
	}

	prefilterKey := c.buildAIChunkCacheKey("prefilter", scopeBookIds, terms, scanLimit)
	if rows, ok := getAIChunkCache(prefilterKey); ok {
		return rows, nil
	}
	if isAISQLPrefilterEnabled() {
		if rows, ok := c.loadSQLPrefilteredChunkCandidates(scopeBookIds, terms, scanLimit); ok {
			setAIChunkCache(prefilterKey, rows)
			return rows, nil
		}
	}

	scopeKey := c.buildAIChunkCacheKey("scope", scopeBookIds, nil, scanLimit)
	if rows, ok := getAIChunkCache(scopeKey); ok {
		return rows, nil
	}
	rows, err := c.queryReadableChunkCandidates(scopeBookIds, scanLimit, "", nil, " ORDER BY c.modify_time DESC", nil)
	if err == nil {
		setAIChunkCache(scopeKey, rows)
	}
	return rows, err
}

func (c *AiController) loadSQLPrefilteredChunkCandidates(scopeBookIds []int, terms []string, scanLimit int) ([]aiChunkCandidate, bool) {
	sqlTerms := buildAISQLPrefilterTerms(terms)
	if len(sqlTerms) == 0 {
		return nil, false
	}

	if isMySQLAdapter() && isAIFullTextEnabled() {
		fullTextQuery := buildAIFullTextQuery(sqlTerms)
		if fullTextQuery != "" {
			rows, err := c.queryReadableChunkCandidates(
				scopeBookIds,
				scanLimit,
				" AND MATCH(c.chunk_title, c.content) AGAINST (? IN BOOLEAN MODE)",
				[]interface{}{fullTextQuery},
				" ORDER BY MATCH(c.chunk_title, c.content) AGAINST (? IN BOOLEAN MODE) DESC, c.modify_time DESC",
				[]interface{}{fullTextQuery},
			)
			if err == nil && len(rows) > 0 {
				return rows, true
			}
			if err != nil {
				logs.Warn("AI fulltext prefilter failed, fallback to LIKE -> ", err)
			}
		}
	}

	likeSQL, likeArgs := buildAILikePrefilterSQL(sqlTerms)
	if likeSQL == "" {
		return nil, false
	}
	orderSQL, orderArgs := buildAILikeOrderSQL(sqlTerms)
	rows, err := c.queryReadableChunkCandidates(scopeBookIds, scanLimit, " AND ("+likeSQL+")", likeArgs, orderSQL, orderArgs)
	if err != nil {
		logs.Warn("AI LIKE prefilter failed, fallback to broad scan -> ", err)
		return nil, false
	}
	return rows, len(rows) > 0
}

func (c *AiController) queryReadableChunkCandidates(scopeBookIds []int, scanLimit int, extraSQL string, extraArgs []interface{}, orderSQL string, orderArgs []interface{}) ([]aiChunkCandidate, error) {
	o := orm.NewOrm()
	chunkTable := models.NewAIKnowledgeChunk().TableNameWithPrefix()
	docTable := models.NewDocument().TableNameWithPrefix()
	bookTable := models.NewBook().TableNameWithPrefix()

	fields := "c.chunk_id, c.document_id, c.book_id, c.chunk_index, c.chunk_title, c.content, c.content_md5, d.document_name, d.identify AS document_identify, b.book_name, b.identify AS book_identify"
	baseSQL := "SELECT " + fields + " FROM " + chunkTable + " c INNER JOIN " + docTable + " d ON c.document_id = d.document_id INNER JOIN " + bookTable + " b ON c.book_id = b.book_id WHERE b.status = 0 AND c.content <> ''"
	scopeSQL, scopeArgs := buildBookScopeSQL(scopeBookIds)
	if orderSQL == "" {
		orderSQL = " ORDER BY c.modify_time DESC"
	}

	var rows []aiChunkCandidate
	if c.Member != nil && c.Member.IsAdministrator() {
		args := appendAIQueryArgs(scopeArgs, extraArgs, nil, orderArgs, scanLimit)
		_, err := o.Raw(baseSQL+scopeSQL+extraSQL+orderSQL+" LIMIT ?", args...).QueryRows(&rows)
		return rows, err
	}

	if c.Member == nil || c.Member.MemberId <= 0 {
		args := appendAIQueryArgs(scopeArgs, extraArgs, nil, orderArgs, scanLimit)
		_, err := o.Raw(baseSQL+scopeSQL+extraSQL+" AND b.privately_owned = 0"+orderSQL+" LIMIT ?", args...).QueryRows(&rows)
		return rows, err
	}

	relationshipTable := models.NewRelationship().TableNameWithPrefix()
	teamRelationshipTable := models.NewTeamRelationship().TableNameWithPrefix()
	teamMemberTable := models.NewTeamMember().TableNameWithPrefix()
	args := appendAIQueryArgs(scopeArgs, extraArgs, []interface{}{c.Member.MemberId, c.Member.MemberId}, orderArgs, scanLimit)
	sql := baseSQL + scopeSQL + extraSQL + " AND (b.privately_owned = 0 OR EXISTS (SELECT 1 FROM " + relationshipTable + " r WHERE r.book_id = b.book_id AND r.member_id = ?) OR EXISTS (SELECT 1 FROM " + teamRelationshipTable + " tr INNER JOIN " + teamMemberTable + " tm ON tm.team_id = tr.team_id WHERE tr.book_id = b.book_id AND tm.member_id = ?))" + orderSQL + " LIMIT ?"
	_, err := o.Raw(sql, args...).QueryRows(&rows)
	return rows, err
}

func appendAIQueryArgs(scopeArgs []interface{}, extraArgs []interface{}, readableArgs []interface{}, orderArgs []interface{}, scanLimit int) []interface{} {
	args := make([]interface{}, 0, len(scopeArgs)+len(extraArgs)+len(readableArgs)+len(orderArgs)+1)
	args = append(args, scopeArgs...)
	args = append(args, extraArgs...)
	args = append(args, readableArgs...)
	args = append(args, orderArgs...)
	args = append(args, scanLimit)
	return args
}

func buildAISQLPrefilterTerms(terms []string) []string {
	limit := web.AppConfig.DefaultInt("ai_sql_prefilter_terms", defaultAISQLPrefilterTerms)
	if limit <= 0 {
		limit = defaultAISQLPrefilterTerms
	}
	seen := make(map[string]bool, limit)
	result := make([]string, 0, len(terms))
	for _, term := range terms {
		term = strings.ToLower(strings.TrimSpace(term))
		length := utf8.RuneCountInString(term)
		if term == "" || length < 2 || length > 48 || seen[term] {
			continue
		}
		seen[term] = true
		result = append(result, term)
	}
	sort.SliceStable(result, func(i, j int) bool {
		leftLen := utf8.RuneCountInString(result[i])
		rightLen := utf8.RuneCountInString(result[j])
		if leftLen != rightLen {
			return leftLen > rightLen
		}
		return i < j
	})
	if len(result) > limit {
		result = result[:limit]
	}
	return result
}

func buildAILikePrefilterSQL(terms []string) (string, []interface{}) {
	if len(terms) == 0 {
		return "", nil
	}
	parts := make([]string, 0, len(terms))
	args := make([]interface{}, 0, len(terms)*4)
	for _, term := range terms {
		pattern := "%" + term + "%"
		parts = append(parts, "(c.chunk_title LIKE ? OR c.content LIKE ? OR d.document_name LIKE ? OR b.book_name LIKE ?)")
		args = append(args, pattern, pattern, pattern, pattern)
	}
	return strings.Join(parts, " OR "), args
}

func buildAILikeOrderSQL(terms []string) (string, []interface{}) {
	if len(terms) == 0 {
		return " ORDER BY c.modify_time DESC", nil
	}
	limit := len(terms)
	if limit > 6 {
		limit = 6
	}
	parts := make([]string, 0, limit*4)
	args := make([]interface{}, 0, limit*4)
	for index, term := range terms[:limit] {
		weight := 10 + (limit-index)*4
		titleWeight := weight * 5
		docWeight := weight * 4
		contentWeight := weight
		pattern := "%" + term + "%"
		parts = append(parts, fmt.Sprintf("CASE WHEN c.chunk_title LIKE ? THEN %d ELSE 0 END", titleWeight))
		args = append(args, pattern)
		parts = append(parts, fmt.Sprintf("CASE WHEN d.document_name LIKE ? THEN %d ELSE 0 END", docWeight))
		args = append(args, pattern)
		parts = append(parts, fmt.Sprintf("CASE WHEN b.book_name LIKE ? THEN %d ELSE 0 END", docWeight/2))
		args = append(args, pattern)
		parts = append(parts, fmt.Sprintf("CASE WHEN c.content LIKE ? THEN %d ELSE 0 END", contentWeight))
		args = append(args, pattern)
	}
	return " ORDER BY (" + strings.Join(parts, " + ") + ") DESC, c.modify_time DESC", args
}

func buildAIFullTextQuery(terms []string) string {
	items := make([]string, 0, len(terms))
	for _, term := range terms {
		term = strings.TrimSpace(term)
		if term == "" {
			continue
		}
		term = strings.NewReplacer("+", " ", "-", " ", "@", " ", ">", " ", "<", " ", "(", " ", ")", " ", "~", " ", "*", " ", "\"", " ").Replace(term)
		term = strings.TrimSpace(term)
		if term == "" {
			continue
		}
		if utf8.RuneCountInString(term) <= 24 {
			items = append(items, "+"+term+"*")
		} else {
			items = append(items, "+"+term)
		}
	}
	return strings.Join(items, " ")
}

func (c *AiController) buildAIChunkCacheKey(kind string, scopeBookIds []int, terms []string, scanLimit int) string {
	memberKey := "anon"
	if c.Member != nil && c.Member.MemberId > 0 {
		if c.Member.IsAdministrator() {
			memberKey = "admin:" + strconv.Itoa(c.Member.MemberId)
		} else {
			memberKey = "member:" + strconv.Itoa(c.Member.MemberId)
		}
	}
	ids := append([]int(nil), scopeBookIds...)
	sort.Ints(ids)
	idParts := make([]string, 0, len(ids))
	for _, id := range ids {
		idParts = append(idParts, strconv.Itoa(id))
	}
	cacheTerms := buildAISQLPrefilterTerms(terms)
	return kind + "|" + memberKey + "|" + strconv.Itoa(scanLimit) + "|" + strings.Join(idParts, ",") + "|" + strings.Join(cacheTerms, ",")
}

func mergeAIChunkCandidates(primary []aiChunkCandidate, extra []aiChunkCandidate) []aiChunkCandidate {
	if len(primary) == 0 {
		return extra
	}
	if len(extra) == 0 {
		return primary
	}
	seen := make(map[int]bool, len(primary)+len(extra))
	result := make([]aiChunkCandidate, 0, len(primary)+len(extra))
	for _, chunk := range primary {
		if chunk.ChunkId <= 0 || seen[chunk.ChunkId] {
			continue
		}
		seen[chunk.ChunkId] = true
		result = append(result, chunk)
	}
	for _, chunk := range extra {
		if chunk.ChunkId <= 0 || seen[chunk.ChunkId] {
			continue
		}
		seen[chunk.ChunkId] = true
		result = append(result, chunk)
	}
	return result
}

func getAIChunkCache(key string) ([]aiChunkCandidate, bool) {
	if !isAIChunkCacheEnabled() {
		return nil, false
	}
	aiChunkCache.RLock()
	item, ok := aiChunkCache.Items[key]
	aiChunkCache.RUnlock()
	if !ok || time.Now().After(item.ExpireAt) {
		if ok {
			aiChunkCache.Lock()
			delete(aiChunkCache.Items, key)
			aiChunkCache.Unlock()
		}
		return nil, false
	}
	return append([]aiChunkCandidate(nil), item.Items...), true
}

func setAIChunkCache(key string, rows []aiChunkCandidate) {
	if !isAIChunkCacheEnabled() || len(rows) == 0 {
		return
	}
	aiChunkCache.Lock()
	aiChunkCache.Items[key] = aiChunkCacheItem{
		Items:    append([]aiChunkCandidate(nil), rows...),
		ExpireAt: time.Now().Add(getAIChunkCacheTTL()),
	}
	aiChunkCache.Unlock()
}

func expandRelevantChunks(scored []aiScoredChunk, candidates []aiChunkCandidate, topN int) []aiScoredChunk {
	if topN <= 0 || len(scored) == 0 {
		return nil
	}

	byDocumentIndex := make(map[string]aiChunkCandidate, len(candidates))
	for _, chunk := range candidates {
		byDocumentIndex[chunkIndexKey(chunk.DocumentId, chunk.ChunkIndex)] = chunk
	}

	selected := make([]aiScoredChunk, 0, topN)
	seen := make(map[int]bool, topN)
	add := func(chunk aiChunkCandidate, score float64) bool {
		if len(selected) >= topN || chunk.ChunkId <= 0 || seen[chunk.ChunkId] {
			return false
		}
		seen[chunk.ChunkId] = true
		selected = append(selected, aiScoredChunk{Chunk: chunk, Score: score})
		return true
	}

	seedLimit := topN
	if seedLimit > 3 {
		seedLimit = 3
	}
	if seedLimit > len(scored) {
		seedLimit = len(scored)
	}

	for i := 0; i < seedLimit; i++ {
		add(scored[i].Chunk, scored[i].Score)
	}

	neighborSeedLimit := seedLimit
	if neighborSeedLimit > 2 {
		neighborSeedLimit = 2
	}
	for i := 0; i < neighborSeedLimit && len(selected) < topN; i++ {
		seed := scored[i]
		for _, offset := range []int{-1, 1} {
			if len(selected) >= topN {
				break
			}
			neighbor, ok := byDocumentIndex[chunkIndexKey(seed.Chunk.DocumentId, seed.Chunk.ChunkIndex+offset)]
			if !ok {
				continue
			}
			add(neighbor, seed.Score*0.62)
		}
	}

	for _, item := range scored {
		if len(selected) >= topN {
			break
		}
		add(item.Chunk, item.Score)
	}

	return selected
}

func chunkIndexKey(documentId, chunkIndex int) string {
	return strconv.Itoa(documentId) + ":" + strconv.Itoa(chunkIndex)
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
		return "No relevant content was found in the MinDoc knowledge chunks."
	}

	var b strings.Builder
	if aiErrMessage != "" {
		b.WriteString("AI call failed: ")
		b.WriteString(aiErrMessage)
		b.WriteString("\n\n")
	}
	b.WriteString("The following relevant MinDoc knowledge chunks were retrieved, but the model did not generate a successful answer.\n\n")
	b.WriteString("Question: ")
	b.WriteString(question)
	b.WriteString("\n\n")
	for index, item := range knowledge {
		b.WriteString(fmt.Sprintf("[%d] %s / %s\n", index+1, item.BookName, item.Title))
		b.WriteString("Source: ")
		b.WriteString(item.SourceUrl)
		b.WriteString("\nContent: ")
		b.WriteString(item.Snippet)
		b.WriteString("\n\n")
	}
	return b.String()
}
func (c *AiController) requestLLMAnswer(question string, knowledge []aiKnowledge, model string) (string, error) {
	apiKey := getAIAPIKey()
	if apiKey == "" {
		return "", fmt.Errorf("AI API key is not configured")
	}

	var contextBuilder strings.Builder
	for index, item := range knowledge {
		contextBuilder.WriteString(fmt.Sprintf("[%d] %s / %s\n", index+1, item.BookName, item.Title))
		contextBuilder.WriteString("Source: ")
		contextBuilder.WriteString(item.SourceUrl)
		contextBuilder.WriteString("\nChunk content: ")
		contextBuilder.WriteString(item.Snippet)
		contextBuilder.WriteString("\n\n")
	}

	systemPrompt := getAISystemPrompt()
	userPrompt := "User question:\n" + question + "\n\nMinDoc knowledge chunks:\n" + contextBuilder.String() +
		"\nPlease answer only from the MinDoc knowledge chunks above. Prefer higher-ranked chunks. Be accurate and concise. Cite source numbers like [1] after key conclusions. If evidence is insufficient, say the knowledge base lacks enough evidence."
	userPrompt += buildAIAnswerRule(question)

	body := buildAIChatRequest(buildAIRequestMessages(systemPrompt, userPrompt), model)

	payload, err := json.Marshal(&body)
	if err != nil {
		return "", err
	}

	raw, statusCode, err := c.doAIRequest(payload, apiKey)
	if err != nil {
		return "", err
	}

	var result openAIChatResponse
	parseErr := json.Unmarshal(raw, &result)
	if statusCode != http.StatusOK {
		msg := fmt.Sprintf("AI provider returned HTTP %d", statusCode)
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
		content = strings.TrimSpace(result.Choices[0].Text)
	}
	if content == "" {
		return "", fmt.Errorf("AI provider returned empty content")
	}
	return content, nil
}
func (c *AiController) requestAgentAnswer(question string, knowledge []aiKnowledge) (string, error) {
	if getAIAgentEndpoint() == "" {
		return "", fmt.Errorf("AI agent endpoint is not configured")
	}

	var contextBuilder strings.Builder
	for index, item := range knowledge {
		contextBuilder.WriteString(fmt.Sprintf("[%d] %s / %s\n", index+1, item.BookName, item.Title))
		contextBuilder.WriteString("Source: ")
		contextBuilder.WriteString(item.SourceUrl)
		contextBuilder.WriteString("\nChunk content: ")
		contextBuilder.WriteString(item.Snippet)
		contextBuilder.WriteString("\n\n")
	}

	systemPrompt := getAISystemPrompt()
	userPrompt := "User question:\n" + question + "\n\nMinDoc knowledge chunks:\n" + contextBuilder.String() +
		"\nPlease answer only from the MinDoc knowledge chunks above. Prefer higher-ranked chunks. Be accurate and concise. Cite source numbers like [1] after key conclusions. If evidence is insufficient, say the knowledge base lacks enough evidence."
	userPrompt += buildAIAnswerRule(question)

	body := buildAIChatRequestForProfile(buildAIRequestMessages(systemPrompt, userPrompt), getAIAgentModel(), getAIAgentRequestProfile())
	payload, err := json.Marshal(&body)
	if err != nil {
		return "", err
	}

	raw, statusCode, err := c.doAIAgentRequest(payload, getAIAgentAPIKey())
	if err != nil {
		return "", err
	}

	var result openAIChatResponse
	parseErr := json.Unmarshal(raw, &result)
	if statusCode != http.StatusOK {
		msg := fmt.Sprintf("AI agent provider returned HTTP %d", statusCode)
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
		return "", fmt.Errorf("AI agent provider returned no choices")
	}
	content := strings.TrimSpace(result.Choices[0].Message.Content)
	if content == "" {
		content = strings.TrimSpace(result.Choices[0].Message.ReasoningContent)
	}
	if content == "" {
		content = strings.TrimSpace(result.Choices[0].Text)
	}
	if content == "" {
		return "", fmt.Errorf("AI agent provider returned empty content")
	}
	return content, nil
}
func (c *AiController) requestCodeWikiAnswer(question string, repoURL string, cnbURL string, cnbUsername string, cnbToken string) (string, error) {
	body := aiCodeWikiRequest{
		RepoURL:     strings.TrimSpace(repoURL),
		CNBURL:      strings.TrimSpace(cnbURL),
		CNBUsername: strings.TrimSpace(cnbUsername),
		CNBToken:    strings.TrimSpace(cnbToken),
		Type:        getAICodeWikiType(),
		Messages: []openAIMessage{
			{Role: "user", Content: question},
		},
		Provider: getAICodeWikiProvider(),
		Model:    getAICodeWikiModel(),
		Language: getAICodeWikiLanguage(),
	}
	payload, err := json.Marshal(&body)
	if err != nil {
		return "", err
	}
	raw, statusCode, err := c.doCodeWikiRequest(payload)
	if err != nil {
		return "", err
	}
	if statusCode != http.StatusOK {
		if rawBody := strings.TrimSpace(string(raw)); rawBody != "" {
			return "", fmt.Errorf("Code Wiki provider returned HTTP %d: %s", statusCode, truncateForAI(rawBody, 1000))
		}
		return "", fmt.Errorf("Code Wiki provider returned HTTP %d", statusCode)
	}
	answer := extractCodeWikiAnswer(raw)
	if answer == "" {
		return "", fmt.Errorf("Code Wiki provider returned empty content")
	}
	return answer, nil
}

func (c *AiController) loadCodeWikiRepoOptions() ([]aiCodeWikiRepoOption, error) {
	result := make([]aiCodeWikiRepoOption, 0)
	seen := make(map[string]bool)
	add := func(label string, value string) {
		value = strings.TrimSpace(value)
		label = strings.TrimSpace(label)
		if value == "" || seen[value] {
			return
		}
		if label == "" {
			label = value
		}
		seen[value] = true
		result = append(result, aiCodeWikiRepoOption{Label: label, Value: value})
	}

	add("", getAICodeWikiDefaultRepoURL())
	endpoint := getAICodeWikiRepoListEndpoint()
	if endpoint == "" {
		return result, nil
	}

	raw, statusCode, err := c.doCodeWikiRepoListRequest()
	if err != nil {
		return result, err
	}
	if statusCode < 200 || statusCode >= 300 {
		if rawBody := strings.TrimSpace(string(raw)); rawBody != "" {
			return result, fmt.Errorf("Code Wiki repo list provider returned HTTP %d: %s", statusCode, truncateForAI(rawBody, 500))
		}
		return result, fmt.Errorf("Code Wiki repo list provider returned HTTP %d", statusCode)
	}
	for _, item := range parseCodeWikiRepoOptions(raw) {
		add(item.Label, item.Value)
	}
	return result, nil
}

func (c *AiController) doCodeWikiRepoListRequest() ([]byte, int, error) {
	method := strings.ToUpper(strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_repo_list_method", "")))
	if method == "" {
		method = strings.ToUpper(strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_repo_list_method", http.MethodGet)))
	}
	if method == "" {
		method = http.MethodGet
	}
	body := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_repo_list_body", ""))
	if body == "" {
		body = strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_repo_list_body", ""))
	}
	var reader io.Reader
	if method != http.MethodGet && body != "" {
		reader = strings.NewReader(body)
	}
	client := buildAIHTTPClient(getAIRequestTimeout())
	request, err := http.NewRequestWithContext(context.Background(), method, getAICodeWikiRepoListEndpoint(), reader)
	if err != nil {
		return nil, 0, err
	}
	request.Header.Set("Accept", "application/json")
	if reader != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	applyCodeWikiRepoListAuthHeader(request)
	response, err := client.Do(request)
	if err != nil {
		return nil, 0, err
	}
	raw, readErr := io.ReadAll(response.Body)
	closeErr := response.Body.Close()
	if readErr != nil {
		return nil, response.StatusCode, readErr
	}
	if closeErr != nil {
		return nil, response.StatusCode, closeErr
	}
	return raw, response.StatusCode, nil
}

func (c *AiController) doCodeWikiRepoAddRequest(cnbURL string, cnbUsername string, cnbToken string) ([]byte, int, error) {
	method := strings.ToUpper(strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_repo_add_method", "")))
	if method == "" {
		method = strings.ToUpper(strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_repo_add_method", http.MethodPost)))
	}
	if method == "" {
		method = http.MethodPost
	}
	payload, err := buildCodeWikiRepoAddPayload(cnbURL, cnbUsername, cnbToken)
	if err != nil {
		return nil, 0, err
	}
	var reader io.Reader
	if method != http.MethodGet {
		reader = bytes.NewReader(payload)
	}
	client := buildAIHTTPClient(getAIRequestTimeout())
	request, err := http.NewRequestWithContext(context.Background(), method, getAICodeWikiRepoAddEndpoint(), reader)
	if err != nil {
		return nil, 0, err
	}
	request.Header.Set("Accept", "application/json")
	if reader != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	applyCodeWikiRepoAddAuthHeader(request)
	response, err := client.Do(request)
	if err != nil {
		return nil, 0, err
	}
	raw, readErr := io.ReadAll(response.Body)
	closeErr := response.Body.Close()
	if readErr != nil {
		return nil, response.StatusCode, readErr
	}
	if closeErr != nil {
		return nil, response.StatusCode, closeErr
	}
	return raw, response.StatusCode, nil
}

func buildCodeWikiRepoAddPayload(cnbURL string, cnbUsername string, cnbToken string) ([]byte, error) {
	bodyTemplate := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_repo_add_body", ""))
	if bodyTemplate == "" {
		bodyTemplate = strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_repo_add_body", ""))
	}
	if bodyTemplate != "" {
		replacements := map[string]string{
			"{{cnb_url}}":      cnbURL,
			"{{cnb_username}}": cnbUsername,
			"{{cnb_token}}":    cnbToken,
			"${cnb_url}":       cnbURL,
			"${cnb_username}":  cnbUsername,
			"${cnb_token}":     cnbToken,
		}
		for oldValue, newValue := range replacements {
			bodyTemplate = strings.ReplaceAll(bodyTemplate, oldValue, newValue)
		}
		return []byte(bodyTemplate), nil
	}
	return json.Marshal(aiCodeWikiRepoAddPayload{
		CNBURL:      cnbURL,
		CNBUsername: cnbUsername,
		CNBToken:    cnbToken,
	})
}

func parseCodeWikiRepoOptions(raw []byte) []aiCodeWikiRepoOption {
	var payload interface{}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil
	}
	result := make([]aiCodeWikiRepoOption, 0)
	var walk func(interface{})
	walk = func(value interface{}) {
		switch item := value.(type) {
		case []interface{}:
			for _, child := range item {
				walk(child)
			}
		case map[string]interface{}:
			repoValue := firstStringValue(item, "repo_url", "repoUrl", "url", "cnb_url", "cnbUrl", "value", "path")
			if repoValue != "" {
				label := firstStringValue(item, "label", "name", "title", "repo_name", "repoName", "project_name", "projectName")
				if label == "" {
					label = repoValue
				}
				result = append(result, aiCodeWikiRepoOption{Label: label, Value: repoValue})
				return
			}
			for _, key := range []string{"data", "list", "items", "repos", "repositories", "records"} {
				if child, ok := item[key]; ok {
					walk(child)
				}
			}
		case string:
			repoValue := strings.TrimSpace(item)
			if repoValue != "" {
				result = append(result, aiCodeWikiRepoOption{Label: repoValue, Value: repoValue})
			}
		}
	}
	walk(payload)
	return result
}

func firstStringValue(data map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := data[key]; ok {
			switch v := value.(type) {
			case string:
				if text := strings.TrimSpace(v); text != "" {
					return text
				}
			case fmt.Stringer:
				if text := strings.TrimSpace(v.String()); text != "" {
					return text
				}
			}
		}
	}
	return ""
}

func (c *AiController) doCodeWikiRequest(payload []byte) ([]byte, int, error) {
	client := buildAIHTTPClient(getAIRequestTimeout())
	request, err := http.NewRequestWithContext(context.Background(), http.MethodPost, getAICodeWikiEndpoint(), bytes.NewReader(payload))
	if err != nil {
		return nil, 0, err
	}
	request.Header.Set("Content-Type", "application/json")
	applyCodeWikiAuthHeader(request)
	response, err := client.Do(request)
	if err != nil {
		return nil, 0, err
	}
	raw, readErr := io.ReadAll(response.Body)
	_ = response.Body.Close()
	if readErr != nil {
		return nil, response.StatusCode, readErr
	}
	return raw, response.StatusCode, nil
}

func extractCodeWikiAnswer(raw []byte) string {
	text := strings.TrimSpace(string(raw))
	if text == "" {
		return ""
	}
	var result openAIChatResponse
	if err := json.Unmarshal(raw, &result); err == nil && len(result.Choices) > 0 {
		content := strings.TrimSpace(result.Choices[0].Message.Content)
		if content == "" {
			content = strings.TrimSpace(result.Choices[0].Text)
		}
		if content != "" {
			return content
		}
	}
	var b strings.Builder
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "data:") {
			line = strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		}
		if line == "" || line == "[DONE]" {
			continue
		}
		var chunk struct {
			Choices []struct {
				Delta   openAIMessage `json:"delta"`
				Message openAIMessage `json:"message"`
				Text    string        `json:"text"`
			} `json:"choices"`
			Content string `json:"content"`
			Text    string `json:"text"`
		}
		if err := json.Unmarshal([]byte(line), &chunk); err == nil {
			if chunk.Content != "" {
				b.WriteString(chunk.Content)
			}
			if chunk.Text != "" {
				b.WriteString(chunk.Text)
			}
			for _, choice := range chunk.Choices {
				if choice.Delta.Content != "" {
					b.WriteString(choice.Delta.Content)
				} else if choice.Message.Content != "" {
					b.WriteString(choice.Message.Content)
				} else if choice.Text != "" {
					b.WriteString(choice.Text)
				}
			}
			continue
		}
		b.WriteString(line)
	}
	if answer := strings.TrimSpace(b.String()); answer != "" {
		return answer
	}
	return text
}

func buildAIRequestMessages(systemPrompt, userPrompt string) []openAIMessage {
	messages := make([]openAIMessage, 0, 2)
	if getAIIncludeSystemPrompt() {
		systemPrompt = strings.TrimSpace(systemPrompt)
		if systemPrompt != "" {
			messages = append(messages, openAIMessage{Role: "system", Content: systemPrompt})
		}
	}
	messages = append(messages, openAIMessage{Role: "user", Content: userPrompt})
	return messages
}

func (c *AiController) doAIRequest(payload []byte, apiKey string) ([]byte, int, error) {
	retries := getAIRequestRetries()
	endpoint := getAIEndpoint()
	client := buildAIHTTPClient(getAIRequestTimeout())
	var lastErr error

	for attempt := 0; attempt <= retries; attempt++ {
		request, err := http.NewRequestWithContext(context.Background(), http.MethodPost, endpoint, bytes.NewReader(payload))
		if err != nil {
			return nil, 0, err
		}
		request.Header.Set("Content-Type", "application/json")
		applyAIAuthHeader(request, apiKey)

		response, err := client.Do(request)
		if err != nil {
			lastErr = err
			if attempt < retries {
				time.Sleep(time.Duration(attempt+1) * 800 * time.Millisecond)
				continue
			}
			return nil, 0, err
		}

		raw, readErr := io.ReadAll(response.Body)
		_ = response.Body.Close()
		if readErr != nil {
			lastErr = readErr
			if attempt < retries {
				time.Sleep(time.Duration(attempt+1) * 800 * time.Millisecond)
				continue
			}
			return nil, response.StatusCode, readErr
		}
		if shouldRetryAIStatus(response.StatusCode) && attempt < retries {
			lastErr = fmt.Errorf("AI provider returned HTTP %d", response.StatusCode)
			time.Sleep(time.Duration(attempt+1) * 800 * time.Millisecond)
			continue
		}
		return raw, response.StatusCode, nil
	}

	if lastErr != nil {
		return nil, 0, lastErr
	}
	return nil, 0, fmt.Errorf("AI request failed")
}

func (c *AiController) doAIAgentRequest(payload []byte, apiKey string) ([]byte, int, error) {
	retries := getAIAgentRequestRetries()
	endpoint := getAIAgentEndpoint()
	client := buildAIHTTPClient(getAIAgentRequestTimeout())
	var lastErr error

	for attempt := 0; attempt <= retries; attempt++ {
		request, err := http.NewRequestWithContext(context.Background(), http.MethodPost, endpoint, bytes.NewReader(payload))
		if err != nil {
			return nil, 0, err
		}
		request.Header.Set("Content-Type", "application/json")
		applyAIAgentAuthHeader(request, apiKey)

		response, err := client.Do(request)
		if err != nil {
			lastErr = err
			if attempt < retries {
				time.Sleep(time.Duration(attempt+1) * 800 * time.Millisecond)
				continue
			}
			return nil, 0, err
		}

		raw, readErr := io.ReadAll(response.Body)
		_ = response.Body.Close()
		if readErr != nil {
			lastErr = readErr
			if attempt < retries {
				time.Sleep(time.Duration(attempt+1) * 800 * time.Millisecond)
				continue
			}
			return nil, response.StatusCode, readErr
		}
		if shouldRetryAIStatus(response.StatusCode) && attempt < retries {
			lastErr = fmt.Errorf("AI agent provider returned HTTP %d", response.StatusCode)
			time.Sleep(time.Duration(attempt+1) * 800 * time.Millisecond)
			continue
		}
		return raw, response.StatusCode, nil
	}

	if lastErr != nil {
		return nil, 0, lastErr
	}
	return nil, 0, fmt.Errorf("AI agent request failed")
}

func buildAIHTTPClient(timeout time.Duration) *http.Client {
	if !isAIForceIPv4Enabled() {
		return &http.Client{Timeout: timeout}
	}

	dialer := &net.Dialer{Timeout: timeout}
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			return dialer.DialContext(ctx, "tcp4", address)
		},
	}
	return &http.Client{Timeout: timeout, Transport: transport}
}

func shouldRetryAIStatus(statusCode int) bool {
	return statusCode == http.StatusTooManyRequests || statusCode == http.StatusBadGateway || statusCode == http.StatusServiceUnavailable || statusCode == http.StatusGatewayTimeout
}

func buildAIAnswerRule(question string) string {
	if !hasCompositionIntent(strings.ToLower(question)) {
		return ""
	}
	return "\n\n" +
		"Answering rules for structure/composition questions:\n" +
		"1. If the question asks about composition, structure, fields, or message parts, list all components that appear in the knowledge chunks, including optional components.\n" +
		"2. For online transaction messages, list request message and response message separately when both are present.\n" +
		"3. If chunks contain reqHeader, reqBody, reqAttach, reqMsgAuth, respHeader, respBody, respAttach, or respMsgAuth, do not omit any of them.\n" +
		"4. Do not rely only on an outline chunk when later chunks provide more complete structure details.\n" +
		"5. If a chunk lists component names but lacks detailed descriptions, still answer with the listed component names instead of saying the chunk does not provide them."
}
func buildAIChatRequest(messages []openAIMessage, model string) aiChatRequest {
	model = resolveAIModel(model)
	return buildAIChatRequestForProfile(messages, model, getAIRequestProfile())
}

func buildAIChatRequestForProfile(messages []openAIMessage, model string, profile string) aiChatRequest {
	body := aiChatRequest{
		Model:    model,
		Messages: messages,
		Stream:   getAIStream(profile),
	}

	if getAIIncludeTemperature(profile) {
		temperature := getAITemperature()
		body.Temperature = &temperature
	}
	if getAIIncludeMaxTokens(profile) {
		maxTokens := getAIMaxTokens()
		body.MaxTokens = &maxTokens
	}
	body.EnableThinking = getAIEnableThinkingForProfile(profile)
	body.Telemetry = getAITelemetry(profile)
	return body
}

func applyAIAuthHeader(request *http.Request, apiKey string) {
	header := getAIAuthHeader()
	if header == "" || apiKey == "" {
		return
	}
	request.Header.Set(header, getAIAuthPrefix()+apiKey)
}

func applyAIAgentAuthHeader(request *http.Request, apiKey string) {
	header := getAIAgentAuthHeader()
	if header == "" || apiKey == "" {
		return
	}
	request.Header.Set(header, getAIAgentAuthPrefix()+apiKey)
}

func applyAIEmbeddingAuthHeader(request *http.Request, apiKey string) {
	header := getAIEmbeddingAuthHeader()
	if header == "" || apiKey == "" {
		return
	}
	request.Header.Set(header, getAIEmbeddingAuthPrefix()+apiKey)
}

func normalizeAITerms(words []string, question string) []string {
	result := make([]string, 0, len(words)+1)
	seen := make(map[string]bool)
	appendTerm := func(word string) {
		word = strings.ToLower(strings.TrimSpace(word))
		if word == "" || seen[word] {
			return
		}
		if utf8.RuneCountInString(word) > 80 {
			return
		}
		seen[word] = true
		result = append(result, word)
	}
	for _, word := range words {
		appendTerm(word)
	}
	question = strings.ToLower(strings.TrimSpace(question))
	if question != "" && utf8.RuneCountInString(question) <= 64 && !seen[question] {
		appendTerm(question)
	}
	for _, term := range expandAIQuestionTerms(question) {
		appendTerm(term)
		if len(result) >= 96 {
			break
		}
	}
	return result
}

func expandAIQuestionTerms(question string) []string {
	cleaned := strings.TrimSpace(question)
	replacers := []string{"what", "why", "how", "please", "?", ",", ".", ";", ":", "!"}
	for _, token := range replacers {
		cleaned = strings.ReplaceAll(cleaned, token, " ")
	}

	terms := make([]string, 0)
	for _, field := range strings.Fields(cleaned) {
		field = strings.TrimSpace(field)
		if field == "" {
			continue
		}
		terms = append(terms, field)
		terms = append(terms, buildQuestionNgrams(field, 2, 6)...)
	}
	return terms
}
func buildQuestionNgrams(text string, minSize, maxSize int) []string {
	runes := make([]rune, 0, len(text))
	result := make([]string, 0)
	flush := func() {
		if len(runes) == 0 {
			return
		}
		if len(runes) < minSize {
			runes = runes[:0]
			return
		}
		for size := minSize; size <= maxSize; size++ {
			if len(runes) < size {
				break
			}
			for start := 0; start+size <= len(runes); start++ {
				result = append(result, string(runes[start:start+size]))
			}
		}
		runes = runes[:0]
	}
	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.Is(unicode.Han, r) {
			runes = append(runes, unicode.ToLower(r))
			continue
		}
		flush()
	}
	flush()
	return result
}

func scoreChunkCandidate(question string, terms []string, chunk aiChunkCandidate) float64 {
	lowerQuestion := strings.ToLower(strings.TrimSpace(question))
	lowerBook := strings.ToLower(chunk.BookName)
	lowerDocument := strings.ToLower(chunk.DocumentName)
	lowerChunkTitle := strings.ToLower(chunk.ChunkTitle)
	lowerTitle := strings.ToLower(chunk.DocumentName + " " + chunk.ChunkTitle)
	lowerContent := strings.ToLower(chunk.Content)

	score := 0.0
	titleHits := 0
	contentHits := 0
	significantTerms := 0
	for _, term := range terms {
		if term == "" {
			continue
		}
		termLen := utf8.RuneCountInString(term)
		if termLen < 2 && !strings.Contains(lowerQuestion, term) {
			continue
		}
		termWeight := float64(termLen)
		if termLen >= 4 {
			termWeight += 4
		}
		significantTerms++
		if strings.Contains(lowerTitle, term) {
			score += 12 + termWeight*1.5
			titleHits++
		}
		if strings.Contains(lowerContent, term) {
			score += 3 + termWeight/2
			contentHits++
		}
	}

	if lowerQuestion != "" && strings.Contains(lowerContent, lowerQuestion) {
		score += 35
	}
	if lowerQuestion != "" && strings.Contains(lowerTitle, lowerQuestion) {
		score += 45
	}
	if significantTerms > 0 {
		titleCoverage := float64(titleHits) / float64(significantTerms)
		contentCoverage := float64(contentHits) / float64(significantTerms)
		score *= 1 + titleCoverage*0.9 + contentCoverage*0.7
	}
	if strings.Contains(lowerTitle, "outline") || strings.Contains(lowerTitle, "overview") {
		score += 8
	}
	if hasCompositionIntent(lowerQuestion) && chunk.ChunkIndex <= 2 {
		score += 6
	}
	if hasCompositionIntent(lowerQuestion) {
		structureTitle := lowerDocument + " " + lowerChunkTitle
		structureScope := lowerBook + " " + structureTitle
		if hasAnyAIToken(structureTitle, aiStructureTitleTokens()) {
			score += 45
		}
		if hasAnyAIToken(lowerContent, aiStructureContentTokens()) {
			score += 24
		}
		if hasAnyAIToken(lowerContent, aiRequestResponseTokens()) {
			score += 22
		}
		if hasAnyAIToken(lowerChunkTitle, []string{"outline", "overview"}) && !hasAnyAIToken(structureTitle, []string{"\u62a5\u6587\u7ed3\u6784", "\u62a5\u6587\u7ec4\u6210", "\u7ed3\u6784", "\u7ec4\u6210"}) {
			score *= 0.7
		}
		if hasAnyAIToken(structureScope, aiNoiseTitleTokens()) && !hasAnyAIToken(structureTitle, aiStructureTitleTokens()) {
			score *= 0.35
		}
		if hasAnyAIToken(lowerContent, aiNoiseContentTokens()) && !hasAnyAIToken(structureTitle, aiStructureTitleTokens()) {
			score *= 0.65
		}
	}
	return score
}

func hasCompositionIntent(question string) bool {
	return hasAnyAIToken(question, []string{
		"\u7ec4\u6210", "\u7ed3\u6784", "\u6784\u6210", "\u683c\u5f0f", "\u5b57\u6bb5", "\u62a5\u6587",
		"header", "body", "reqheader", "respheader", "reqbody", "respbody",
	})
}

func hasAnyAIToken(text string, tokens []string) bool {
	text = strings.ToLower(text)
	for _, token := range tokens {
		token = strings.ToLower(strings.TrimSpace(token))
		if token != "" && strings.Contains(text, token) {
			return true
		}
	}
	return false
}

func aiStructureTitleTokens() []string {
	return []string{
		"\u62a5\u6587\u7ed3\u6784", "\u62a5\u6587\u7ec4\u6210", "\u62a5\u6587\u5bf9\u8c61", "\u5bf9\u8c61\u6539\u9020\u89c4\u8303",
		"\u5bf9\u8c61\u89c4\u8303", "\u7ed3\u6784", "\u7ec4\u6210", "\u89c4\u8303", "\u5b57\u6bb5",
		"header", "body", "reqheader", "respheader", "reqbody", "respbody",
	}
}

func aiStructureContentTokens() []string {
	return []string{
		"\u8bf7\u6c42\u62a5\u6587", "\u54cd\u5e94\u62a5\u6587", "\u62a5\u6587\u5934", "\u62a5\u6587\u4f53",
		"\u8bf7\u6c42\u62a5\u6587\u5934", "\u54cd\u5e94\u62a5\u6587\u5934", "\u8054\u673a\u4ea4\u6613",
		"reqheader", "reqbody", "reqattach", "reqmsgauth", "respheader", "respbody", "respattach", "respmsgauth",
	}
}

func aiRequestResponseTokens() []string {
	return []string{
		"\u8bf7\u6c42\u62a5\u6587", "\u54cd\u5e94\u62a5\u6587", "reqheader", "reqbody", "respheader", "respbody",
	}
}

func aiNoiseTitleTokens() []string {
	return []string{
		"\u4f1a\u8bae", "\u63d0\u9192", "\u6536\u96c6", "\u6d4b\u8bd5", "\u73af\u5883", "\u901a\u77e5",
		"sos", "meeting",
	}
}

func aiNoiseContentTokens() []string {
	return []string{
		"\u4f1a\u8bae", "\u63d0\u9192", "\u6536\u96c6", "\u8bf7\u5404\u7ec4", "\u6d4b\u8bd5\u73af\u5883", "\u5b89\u5168\u6d4b\u8bd5",
	}
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

func getAIModelOptions() []string {
	defaultModel := getAIModel()
	raw := web.AppConfig.DefaultString("ai_model_options", "")
	seen := make(map[string]bool)
	result := make([]string, 0)
	add := func(model string) {
		model = strings.TrimSpace(model)
		if model == "" || seen[model] {
			return
		}
		seen[model] = true
		result = append(result, model)
	}
	add(defaultModel)
	for _, part := range strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ';' || r == '\n' || r == '\r' || r == '\t'
	}) {
		add(part)
	}
	add(defaultAIAgentModelName)
	add(defaultAICodeWikiModelName)
	return result
}

func resolveAIModel(model string) string {
	model = strings.TrimSpace(model)
	if model == "" {
		return getAIModel()
	}
	for _, option := range getAIModelOptions() {
		if model == option {
			return model
		}
	}
	return getAIModel()
}

func isCodeWikiModel(model string) bool {
	return strings.EqualFold(strings.TrimSpace(model), defaultAICodeWikiModelName)
}

func isAIAgentModel(model string) bool {
	return strings.EqualFold(strings.TrimSpace(model), defaultAIAgentModelName)
}

func isAIAgentConfigured() bool {
	return getAIAgentEndpoint() != ""
}

func getAIAgentEndpoint() string {
	endpoint := strings.TrimSpace(web.AppConfig.DefaultString("ai_agent_endpoint", ""))
	if endpoint == "" {
		return ""
	}
	if !strings.Contains(endpoint, "/chat/completions") && !strings.Contains(endpoint, "/completions") {
		endpoint = strings.TrimRight(endpoint, "/") + "/chat/completions"
	}
	return endpoint
}

func getAIAgentAPIKey() string {
	key := strings.TrimSpace(web.AppConfig.DefaultString("ai_agent_api_key", ""))
	if key != "" {
		return key
	}
	key = strings.TrimSpace(os.Getenv("AI_AGENT_API_KEY"))
	if key != "" {
		return key
	}
	if web.AppConfig.DefaultBool("ai_agent_fallback_api_key", false) {
		return getAIAPIKey()
	}
	return ""
}

func getAIAgentModel() string {
	model := strings.TrimSpace(web.AppConfig.DefaultString("ai_agent_model", ""))
	if model == "" {
		return getAIModel()
	}
	return model
}

func getAIAgentRequestProfile() string {
	profile := strings.ToLower(strings.TrimSpace(web.AppConfig.DefaultString("ai_agent_request_profile", "auto")))
	if profile == "" || profile == "auto" {
		profile = getAIRequestProfile()
	}
	switch profile {
	case "bocai", "aicoding", "openai":
		return profile
	default:
		return getAIRequestProfile()
	}
}

func getAIAgentAuthHeader() string {
	raw := strings.TrimSpace(web.AppConfig.DefaultString("ai_agent_auth_header", "auto"))
	if raw != "" && !strings.EqualFold(raw, "auto") {
		if strings.EqualFold(raw, "none") {
			return ""
		}
		return raw
	}
	if getAIAgentRequestProfile() == "aicoding" {
		return "Token"
	}
	return defaultAIAuthHeader
}

func getAIAgentAuthPrefix() string {
	raw := web.AppConfig.DefaultString("ai_agent_auth_prefix", "auto")
	raw = strings.Trim(raw, "\"")
	compact := strings.TrimSpace(raw)
	if compact != "" && !strings.EqualFold(compact, "auto") {
		if strings.EqualFold(compact, "none") {
			return ""
		}
		if strings.EqualFold(compact, "bearer") {
			return defaultAIAuthPrefix
		}
		return raw
	}
	if getAIAgentRequestProfile() == "openai" {
		return defaultAIAuthPrefix
	}
	return ""
}

func getAIAgentRequestTimeout() time.Duration {
	timeout := web.AppConfig.DefaultInt("ai_agent_request_timeout", 0)
	if timeout <= 0 {
		return getAIRequestTimeout()
	}
	return time.Duration(timeout) * time.Second
}

func getAIAgentRequestRetries() int {
	retries := web.AppConfig.DefaultInt("ai_agent_request_retries", getAIRequestRetries())
	if retries < 0 {
		return 0
	}
	if retries > 5 {
		return 5
	}
	return retries
}

func getAICodeWikiEndpoint() string {
	endpoint := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_endpoint", ""))
	if endpoint == "" {
		endpoint = strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_endpoint", defaultAICodeWikiEndpoint))
	}
	if endpoint == "" {
		return defaultAICodeWikiEndpoint
	}
	return endpoint
}

func getAICodeWikiAPIKey() string {
	key := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_api_key", ""))
	if key != "" {
		return key
	}
	key = strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_api_key", ""))
	if key != "" {
		return key
	}
	key = strings.TrimSpace(os.Getenv("CODE_WIKI_API_KEY"))
	if key != "" {
		return key
	}
	key = strings.TrimSpace(os.Getenv("AI_CODE_WIKI_API_KEY"))
	if key != "" {
		return key
	}
	return getAIAPIKey()
}

func getAICodeWikiAuthHeader() string {
	header := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_auth_header", ""))
	if header == "" {
		header = strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_auth_header", defaultAIAuthHeader))
	}
	if strings.EqualFold(header, "none") {
		return ""
	}
	return header
}

func getAICodeWikiAuthPrefix() string {
	prefix := web.AppConfig.DefaultString("code_wiki_auth_prefix", "")
	if strings.TrimSpace(prefix) == "" {
		prefix = web.AppConfig.DefaultString("ai_code_wiki_auth_prefix", defaultAIAuthPrefix)
	}
	compact := strings.TrimSpace(prefix)
	if strings.EqualFold(compact, "none") {
		return ""
	}
	if strings.EqualFold(compact, "bearer") {
		return defaultAIAuthPrefix
	}
	return prefix
}

func applyCodeWikiAuthHeader(request *http.Request) {
	header := getAICodeWikiAuthHeader()
	apiKey := getAICodeWikiAPIKey()
	if header == "" || apiKey == "" {
		return
	}
	request.Header.Set(header, getAICodeWikiAuthPrefix()+apiKey)
}

func getAICodeWikiDefaultRepoURL() string {
	repoURL := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_repo_url", ""))
	if repoURL != "" {
		return repoURL
	}
	return strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_repo_url", ""))
}

func getAICodeWikiRepoListEndpoint() string {
	endpoint := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_repo_list_endpoint", ""))
	if endpoint != "" {
		return endpoint
	}
	return strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_repo_list_endpoint", ""))
}

func getAICodeWikiRepoAddEndpoint() string {
	endpoint := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_repo_add_endpoint", ""))
	if endpoint != "" {
		return endpoint
	}
	return strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_repo_add_endpoint", ""))
}

func getAICodeWikiRepoListAPIKey() string {
	key := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_repo_list_api_key", ""))
	if key != "" {
		return key
	}
	key = strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_repo_list_api_key", ""))
	if key != "" {
		return key
	}
	key = strings.TrimSpace(os.Getenv("CODE_WIKI_REPO_LIST_API_KEY"))
	if key != "" {
		return key
	}
	key = strings.TrimSpace(os.Getenv("AI_CODE_WIKI_REPO_LIST_API_KEY"))
	if key != "" {
		return key
	}
	return getAICodeWikiAPIKey()
}

func getAICodeWikiRepoListAuthHeader() string {
	header := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_repo_list_auth_header", ""))
	if header == "" {
		header = strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_repo_list_auth_header", defaultAIAuthHeader))
	}
	if strings.EqualFold(header, "none") {
		return ""
	}
	return header
}

func getAICodeWikiRepoAddAPIKey() string {
	key := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_repo_add_api_key", ""))
	if key != "" {
		return key
	}
	key = strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_repo_add_api_key", ""))
	if key != "" {
		return key
	}
	key = strings.TrimSpace(os.Getenv("CODE_WIKI_REPO_ADD_API_KEY"))
	if key != "" {
		return key
	}
	key = strings.TrimSpace(os.Getenv("AI_CODE_WIKI_REPO_ADD_API_KEY"))
	if key != "" {
		return key
	}
	return getAICodeWikiRepoListAPIKey()
}

func getAICodeWikiRepoAddAuthHeader() string {
	header := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_repo_add_auth_header", ""))
	if header == "" {
		header = strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_repo_add_auth_header", getAICodeWikiRepoListAuthHeader()))
	}
	if strings.EqualFold(header, "none") {
		return ""
	}
	return header
}

func getAICodeWikiRepoAddAuthPrefix() string {
	prefix := web.AppConfig.DefaultString("code_wiki_repo_add_auth_prefix", "")
	if strings.TrimSpace(prefix) == "" {
		prefix = web.AppConfig.DefaultString("ai_code_wiki_repo_add_auth_prefix", getAICodeWikiRepoListAuthPrefix())
	}
	compact := strings.TrimSpace(prefix)
	if strings.EqualFold(compact, "none") {
		return ""
	}
	if strings.EqualFold(compact, "bearer") {
		return defaultAIAuthPrefix
	}
	return prefix
}

func getAICodeWikiRepoListAuthPrefix() string {
	prefix := web.AppConfig.DefaultString("code_wiki_repo_list_auth_prefix", "")
	if strings.TrimSpace(prefix) == "" {
		prefix = web.AppConfig.DefaultString("ai_code_wiki_repo_list_auth_prefix", defaultAIAuthPrefix)
	}
	compact := strings.TrimSpace(prefix)
	if strings.EqualFold(compact, "none") {
		return ""
	}
	if strings.EqualFold(compact, "bearer") {
		return defaultAIAuthPrefix
	}
	return prefix
}

func applyCodeWikiRepoListAuthHeader(request *http.Request) {
	header := getAICodeWikiRepoListAuthHeader()
	apiKey := getAICodeWikiRepoListAPIKey()
	if header == "" || apiKey == "" {
		return
	}
	request.Header.Set(header, getAICodeWikiRepoListAuthPrefix()+apiKey)
}

func applyCodeWikiRepoAddAuthHeader(request *http.Request) {
	header := getAICodeWikiRepoAddAuthHeader()
	apiKey := getAICodeWikiRepoAddAPIKey()
	if header == "" || apiKey == "" {
		return
	}
	request.Header.Set(header, getAICodeWikiRepoAddAuthPrefix()+apiKey)
}

func getAICodeWikiProvider() string {
	provider := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_provider", ""))
	if provider == "" {
		provider = strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_provider", defaultAICodeWikiProvider))
	}
	if provider == "" {
		return defaultAICodeWikiProvider
	}
	return provider
}

func getAICodeWikiModel() string {
	model := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_model", ""))
	if model == "" {
		model = strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_model", defaultAICodeWikiModel))
	}
	if model == "" {
		return defaultAICodeWikiModel
	}
	return model
}

func getAICodeWikiLanguage() string {
	language := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_language", ""))
	if language == "" {
		language = strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_language", defaultAICodeWikiLanguage))
	}
	if language == "" {
		return defaultAICodeWikiLanguage
	}
	return language
}

func getAICodeWikiType() string {
	wikiType := strings.TrimSpace(web.AppConfig.DefaultString("code_wiki_type", ""))
	if wikiType == "" {
		wikiType = strings.TrimSpace(web.AppConfig.DefaultString("ai_code_wiki_type", defaultAICodeWikiType))
	}
	if wikiType == "" {
		return defaultAICodeWikiType
	}
	return wikiType
}

func getAIEndpoint() string {
	endpoint := strings.TrimSpace(web.AppConfig.DefaultString("ai_endpoint", defaultAIRestEndpoint))
	if endpoint == "" {
		return defaultAIRestEndpoint
	}
	if !strings.Contains(endpoint, "/chat/completions") && !strings.Contains(endpoint, "/completions") {
		endpoint = strings.TrimRight(endpoint, "/") + "/chat/completions"
	}
	return endpoint
}

func getAIRequestProfile() string {
	profile := strings.ToLower(strings.TrimSpace(web.AppConfig.DefaultString("ai_request_profile", defaultAIRequestProfile)))
	switch profile {
	case "bocai", "aicoding", "openai":
		return profile
	default:
		return defaultAIRequestProfile
	}
}

func getAIAuthHeader() string {
	raw := strings.TrimSpace(web.AppConfig.DefaultString("ai_auth_header", "auto"))
	if raw != "" && !strings.EqualFold(raw, "auto") {
		if strings.EqualFold(raw, "none") {
			return ""
		}
		return raw
	}
	if getAIRequestProfile() == "aicoding" {
		return "Token"
	}
	return defaultAIAuthHeader
}

func getAIAuthPrefix() string {
	raw := web.AppConfig.DefaultString("ai_auth_prefix", "auto")
	raw = strings.Trim(raw, "\"")
	compact := strings.TrimSpace(raw)
	if compact != "" && !strings.EqualFold(compact, "auto") {
		if strings.EqualFold(compact, "none") {
			return ""
		}
		if strings.EqualFold(compact, "bearer") {
			return defaultAIAuthPrefix
		}
		return raw
	}
	if getAIRequestProfile() == "openai" {
		return defaultAIAuthPrefix
	}
	return ""
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

func getAIRequestRetries() int {
	retries := web.AppConfig.DefaultInt("ai_request_retries", 2)
	if retries < 0 {
		return 0
	}
	if retries > 5 {
		return 5
	}
	return retries
}

func isAIForceIPv4Enabled() bool {
	return web.AppConfig.DefaultBool("ai_force_ipv4", true)
}

func isAISQLPrefilterEnabled() bool {
	return web.AppConfig.DefaultBool("ai_enable_sql_prefilter", true)
}

func isAIFullTextEnabled() bool {
	return web.AppConfig.DefaultBool("ai_enable_fulltext", true)
}

func isAIChunkCacheEnabled() bool {
	return web.AppConfig.DefaultBool("ai_chunk_cache_enabled", true)
}

func getAIChunkCacheTTL() time.Duration {
	ttl := web.AppConfig.DefaultInt("ai_chunk_cache_ttl", defaultAIChunkCacheTTL)
	if ttl <= 0 {
		ttl = defaultAIChunkCacheTTL
	}
	return time.Duration(ttl) * time.Second
}

func isMySQLAdapter() bool {
	return strings.EqualFold(strings.TrimSpace(web.AppConfig.DefaultString("db_adapter", "")), "mysql")
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

func getAIEnableThinkingForProfile(profile string) *bool {
	enabled := getAIEnableThinking()
	if enabled == nil {
		return nil
	}
	if include, ok := getOptionalBoolConfig("ai_include_enable_thinking"); ok {
		if include {
			return enabled
		}
		return nil
	}
	if profile == "openai" {
		return enabled
	}
	return nil
}

func getAIIncludeSystemPrompt() bool {
	if include, ok := getOptionalBoolConfig("ai_include_system_prompt"); ok {
		return include
	}
	return getAIRequestProfile() == "openai"
}

func getAIIncludeTemperature(profile string) bool {
	if include, ok := getOptionalBoolConfig("ai_include_temperature"); ok {
		return include
	}
	return profile == "openai" || profile == "aicoding"
}

func getAIIncludeMaxTokens(profile string) bool {
	if include, ok := getOptionalBoolConfig("ai_include_max_tokens"); ok {
		return include
	}
	return profile == "openai" || profile == "aicoding"
}

func getAIStream(profile string) *bool {
	if stream, ok := getOptionalBoolConfig("ai_stream"); ok {
		return &stream
	}
	if profile == "aicoding" {
		stream := false
		return &stream
	}
	return nil
}

func getAITelemetry(profile string) map[string]string {
	include := profile == "aicoding"
	if configured, ok := getOptionalBoolConfig("ai_include_telemetry"); ok {
		include = configured
	}
	if !include {
		return nil
	}
	return map[string]string{
		"name":          web.AppConfig.DefaultString("ai_telemetry_name", ""),
		"clientName":    web.AppConfig.DefaultString("ai_telemetry_client_name", ""),
		"clientVersion": web.AppConfig.DefaultString("ai_telemetry_client_version", ""),
	}
}

func getOptionalBoolConfig(key string) (bool, bool) {
	raw := strings.TrimSpace(web.AppConfig.DefaultString(key, ""))
	if raw == "" {
		return false, false
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return false, false
	}
	return value, true
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
	return "You are a MinDoc knowledge-base assistant. Answer in Chinese when possible. Use only the provided MinDoc knowledge chunks and do not invent unsupported facts."
}

func (c *AiController) buildAIEmbeddingScores(question string, candidates []aiChunkCandidate) (scores map[int]float64, stats aiEmbeddingStats) {
	start := time.Now()
	scores = make(map[int]float64)
	stats = aiEmbeddingStats{
		Enabled:    true,
		Model:      getAIEmbeddingModel(),
		Candidates: len(candidates),
	}
	defer func() {
		stats.ElapsedMS = time.Since(start).Milliseconds()
	}()
	if len(candidates) == 0 {
		return scores, stats
	}
	if err := models.EnsureAIKnowledgeEmbeddingTable(); err != nil {
		logs.Warn("AI embedding table ensure failed, skip vector retrieval -> ", err)
		stats.Error = err.Error()
		return scores, stats
	}

	stats.QueryCalled = true
	queryVectors, err := c.requestAIEmbeddings([]string{question})
	if err != nil || len(queryVectors) == 0 || len(queryVectors[0]) == 0 {
		if err != nil {
			logs.Warn("AI query embedding failed, skip vector retrieval -> ", err)
			stats.Error = err.Error()
		}
		return scores, stats
	}
	queryVector := queryVectors[0]

	stored, err := c.loadStoredAIEmbeddings(candidates)
	if err != nil {
		logs.Warn("AI stored embedding loading failed, continue with backfill only -> ", err)
		stats.Error = err.Error()
		stored = map[int]aiStoredEmbedding{}
	}

	model := getAIEmbeddingModel()
	vectors := make(map[int][]float64, len(candidates))
	missing := make([]aiChunkCandidate, 0)
	backfillLimit := getAIEmbeddingBackfillLimit()
	for _, chunk := range candidates {
		if chunk.ChunkId <= 0 {
			continue
		}
		if item, ok := stored[chunk.ChunkId]; ok && item.ContentMd5 == chunk.ContentMd5 && item.EmbeddingModel == model {
			vector, parseErr := parseAIEmbeddingVector(item.Embedding)
			if parseErr == nil && len(vector) > 0 {
				vectors[chunk.ChunkId] = vector
				stats.Stored++
				continue
			}
		}
		if backfillLimit <= 0 || len(missing) < backfillLimit {
			missing = append(missing, chunk)
		}
	}

	if len(missing) > 0 {
		stats.BackfillCalled = true
		stats.Backfilled = c.backfillAIEmbeddings(missing, vectors)
	}

	for _, chunk := range candidates {
		vector := vectors[chunk.ChunkId]
		if len(vector) == 0 {
			continue
		}
		if similarity := cosineSimilarity(queryVector, vector); similarity > 0 {
			scores[chunk.ChunkId] = similarity
			stats.Matched++
		}
	}
	return scores, stats
}

func (c *AiController) backfillAIEmbeddings(chunks []aiChunkCandidate, vectors map[int][]float64) int {
	backfilled := 0
	batchSize := getAIEmbeddingBatchSize()
	for start := 0; start < len(chunks); start += batchSize {
		end := start + batchSize
		if end > len(chunks) {
			end = len(chunks)
		}
		batch := chunks[start:end]
		inputs := make([]string, 0, len(batch))
		for _, chunk := range batch {
			inputs = append(inputs, buildAIEmbeddingText(chunk))
		}
		embeddings, err := c.requestAIEmbeddings(inputs)
		if err != nil {
			logs.Warn("AI chunk embedding backfill failed -> ", err)
			return backfilled
		}
		for index, vector := range embeddings {
			if index >= len(batch) || len(vector) == 0 {
				continue
			}
			chunk := batch[index]
			vectors[chunk.ChunkId] = vector
			backfilled++
			if err := upsertAIKnowledgeEmbedding(chunk, vector); err != nil {
				logs.Warn("AI chunk embedding save failed -> ", chunk.ChunkId, err)
			}
		}
	}
	return backfilled
}

func (c *AiController) loadStoredAIEmbeddings(candidates []aiChunkCandidate) (map[int]aiStoredEmbedding, error) {
	ids := make([]int, 0, len(candidates))
	seen := make(map[int]bool, len(candidates))
	for _, chunk := range candidates {
		if chunk.ChunkId <= 0 || seen[chunk.ChunkId] {
			continue
		}
		seen[chunk.ChunkId] = true
		ids = append(ids, chunk.ChunkId)
	}
	result := make(map[int]aiStoredEmbedding, len(ids))
	if len(ids) == 0 {
		return result, nil
	}

	placeholders := make([]string, 0, len(ids))
	args := make([]interface{}, 0, len(ids))
	for _, id := range ids {
		placeholders = append(placeholders, "?")
		args = append(args, id)
	}

	rows := make([]aiStoredEmbedding, 0)
	table := models.NewAIKnowledgeEmbedding().TableNameWithPrefix()
	sql := "SELECT chunk_id, content_md5, embedding_model, embedding_dim, embedding FROM " + table + " WHERE chunk_id IN (" + strings.Join(placeholders, ",") + ")"
	_, err := orm.NewOrm().Raw(sql, args...).QueryRows(&rows)
	if err != nil {
		return result, err
	}
	for _, row := range rows {
		result[row.ChunkId] = row
	}
	return result, nil
}

func (c *AiController) requestAIEmbeddings(inputs []string) ([][]float64, error) {
	apiKey := getAIEmbeddingAPIKey()
	if apiKey == "" {
		return nil, fmt.Errorf("AI embedding API key is not configured")
	}
	model := getAIEmbeddingModel()
	if model == "" {
		return nil, fmt.Errorf("AI embedding model is not configured")
	}
	cleanInputs := make([]string, 0, len(inputs))
	for _, input := range inputs {
		input = strings.TrimSpace(input)
		if input == "" {
			input = "empty"
		}
		cleanInputs = append(cleanInputs, input)
	}
	var requestInput interface{} = cleanInputs
	if getAIEmbeddingInputFormat() == "string" {
		if len(cleanInputs) != 1 {
			return nil, fmt.Errorf("AI embedding string input format only supports one input per request")
		}
		requestInput = cleanInputs[0]
	}
	body := aiEmbeddingRequest{Model: model, Input: requestInput}
	payload, err := json.Marshal(&body)
	if err != nil {
		return nil, err
	}

	raw, statusCode, err := c.doAIEmbeddingRequest(payload, apiKey)
	if err != nil {
		return nil, err
	}
	var result aiEmbeddingResponse
	parseErr := json.Unmarshal(raw, &result)
	if statusCode != http.StatusOK {
		msg := fmt.Sprintf("AI embedding provider returned HTTP %d", statusCode)
		if parseErr == nil && result.Error.Message != "" {
			msg += ": " + result.Error.Message
		} else if rawBody := strings.TrimSpace(string(raw)); rawBody != "" {
			msg += ": " + truncateForAI(rawBody, 1000)
		}
		return nil, fmt.Errorf("%s", msg)
	}
	if parseErr != nil {
		return nil, parseErr
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("AI embedding provider returned no vectors")
	}

	vectors := make([][]float64, len(cleanInputs))
	for _, item := range result.Data {
		if item.Index >= 0 && item.Index < len(vectors) && len(vectors[item.Index]) == 0 {
			vectors[item.Index] = item.Embedding
		}
	}
	for index, item := range result.Data {
		if index >= len(vectors) {
			break
		}
		if len(vectors[index]) == 0 {
			vectors[index] = item.Embedding
		}
	}
	return vectors, nil
}

func (c *AiController) doAIEmbeddingRequest(payload []byte, apiKey string) ([]byte, int, error) {
	endpoint := getAIEmbeddingEndpoint()
	if endpoint == "" {
		return nil, 0, fmt.Errorf("AI embedding endpoint is not configured")
	}
	client := buildAIHTTPClient(getAIEmbeddingTimeout())
	retries := getAIRequestRetries()
	var lastErr error
	for attempt := 0; attempt <= retries; attempt++ {
		request, err := http.NewRequestWithContext(context.Background(), http.MethodPost, endpoint, bytes.NewReader(payload))
		if err != nil {
			return nil, 0, err
		}
		request.Header.Set("Content-Type", "application/json")
		applyAIEmbeddingAuthHeader(request, apiKey)

		response, err := client.Do(request)
		if err != nil {
			lastErr = err
			if attempt < retries {
				time.Sleep(time.Duration(attempt+1) * 800 * time.Millisecond)
				continue
			}
			return nil, 0, err
		}
		raw, readErr := io.ReadAll(response.Body)
		_ = response.Body.Close()
		if readErr != nil {
			lastErr = readErr
			if attempt < retries {
				time.Sleep(time.Duration(attempt+1) * 800 * time.Millisecond)
				continue
			}
			return nil, response.StatusCode, readErr
		}
		if shouldRetryAIStatus(response.StatusCode) && attempt < retries {
			lastErr = fmt.Errorf("AI embedding provider returned HTTP %d", response.StatusCode)
			time.Sleep(time.Duration(attempt+1) * 800 * time.Millisecond)
			continue
		}
		return raw, response.StatusCode, nil
	}
	if lastErr != nil {
		return nil, 0, lastErr
	}
	return nil, 0, fmt.Errorf("AI embedding request failed")
}

func upsertAIKnowledgeEmbedding(chunk aiChunkCandidate, vector []float64) error {
	if chunk.ChunkId <= 0 || len(vector) == 0 {
		return nil
	}
	raw, err := json.Marshal(vector)
	if err != nil {
		return err
	}
	table := models.NewAIKnowledgeEmbedding().TableNameWithPrefix()
	sql := "INSERT INTO " + table + " (chunk_id, document_id, book_id, content_md5, embedding_model, embedding_dim, embedding, create_time, modify_time) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE document_id = VALUES(document_id), book_id = VALUES(book_id), content_md5 = VALUES(content_md5), embedding_model = VALUES(embedding_model), embedding_dim = VALUES(embedding_dim), embedding = VALUES(embedding), modify_time = NOW()"
	_, err = orm.NewOrm().Raw(sql, chunk.ChunkId, chunk.DocumentId, chunk.BookId, chunk.ContentMd5, getAIEmbeddingModel(), len(vector), string(raw)).Exec()
	return err
}

func parseAIEmbeddingVector(raw string) ([]float64, error) {
	vector := make([]float64, 0)
	if strings.TrimSpace(raw) == "" {
		return vector, nil
	}
	err := json.Unmarshal([]byte(raw), &vector)
	return vector, err
}

func buildAIEmbeddingText(chunk aiChunkCandidate) string {
	parts := []string{chunk.BookName, chunk.DocumentName, chunk.ChunkTitle, chunk.Content}
	text := strings.TrimSpace(strings.Join(parts, "\n"))
	maxLength := getAIEmbeddingTextLength()
	if maxLength <= 0 {
		return text
	}
	runes := []rune(text)
	if len(runes) <= maxLength {
		return text
	}
	return string(runes[:maxLength])
}

func cosineSimilarity(left []float64, right []float64) float64 {
	limit := len(left)
	if len(right) < limit {
		limit = len(right)
	}
	if limit == 0 {
		return 0
	}
	var dot, leftNorm, rightNorm float64
	for index := 0; index < limit; index++ {
		l := left[index]
		r := right[index]
		dot += l * r
		leftNorm += l * l
		rightNorm += r * r
	}
	if leftNorm == 0 || rightNorm == 0 {
		return 0
	}
	return dot / (math.Sqrt(leftNorm) * math.Sqrt(rightNorm))
}

func isAIEmbeddingEnabled() bool {
	return web.AppConfig.DefaultBool("ai_embedding_enabled", false) && getAIEmbeddingModel() != ""
}

func isAIEmbeddingConfigured() bool {
	return getAIEmbeddingModel() != ""
}

func parseAIEmbeddingEnabledChoice(raw string) bool {
	raw = strings.TrimSpace(strings.ToLower(raw))
	switch raw {
	case "1", "true", "on", "yes", "y":
		return true
	default:
		return false
	}
}

func getAIEmbeddingModel() string {
	return strings.TrimSpace(web.AppConfig.DefaultString("ai_embedding_model", ""))
}

func getAIEmbeddingRequestProfile() string {
	profile := strings.ToLower(strings.TrimSpace(web.AppConfig.DefaultString("ai_embedding_request_profile", "auto")))
	if profile == "" || profile == "auto" {
		profile = getAIRequestProfile()
	}
	switch profile {
	case "bocai", "aicoding", "openai":
		return profile
	default:
		return getAIRequestProfile()
	}
}

func getAIEmbeddingAPIKey() string {
	key := strings.TrimSpace(web.AppConfig.DefaultString("ai_embedding_api_key", ""))
	if key != "" {
		return key
	}
	key = strings.TrimSpace(os.Getenv("AI_EMBEDDING_API_KEY"))
	if key != "" {
		return key
	}
	return getAIAPIKey()
}

func getAIEmbeddingAuthHeader() string {
	raw := strings.TrimSpace(web.AppConfig.DefaultString("ai_embedding_auth_header", "auto"))
	if raw != "" && !strings.EqualFold(raw, "auto") {
		if strings.EqualFold(raw, "none") {
			return ""
		}
		return raw
	}
	if getAIEmbeddingRequestProfile() == "aicoding" {
		return "Token"
	}
	return defaultAIAuthHeader
}

func getAIEmbeddingAuthPrefix() string {
	raw := web.AppConfig.DefaultString("ai_embedding_auth_prefix", "auto")
	raw = strings.Trim(raw, "\"")
	compact := strings.TrimSpace(raw)
	if compact != "" && !strings.EqualFold(compact, "auto") {
		if strings.EqualFold(compact, "none") {
			return ""
		}
		if strings.EqualFold(compact, "bearer") {
			return defaultAIAuthPrefix
		}
		return raw
	}
	switch getAIEmbeddingRequestProfile() {
	case "openai", "bocai":
		return defaultAIAuthPrefix
	default:
		return ""
	}
}

func getAIEmbeddingInputFormat() string {
	format := strings.ToLower(strings.TrimSpace(web.AppConfig.DefaultString("ai_embedding_input_format", "array")))
	switch format {
	case "string":
		return "string"
	default:
		return "array"
	}
}

func getAIEmbeddingEndpoint() string {
	endpoint := strings.TrimSpace(web.AppConfig.DefaultString("ai_embedding_endpoint", ""))
	if endpoint != "" {
		return endpoint
	}
	endpoint = strings.TrimSpace(getAIEndpoint())
	if strings.HasSuffix(endpoint, "/chat/completions") {
		return strings.TrimSuffix(endpoint, "/chat/completions") + "/embeddings"
	}
	return endpoint
}

func getAIEmbeddingBatchSize() int {
	if getAIEmbeddingInputFormat() == "string" {
		return 1
	}
	batchSize := web.AppConfig.DefaultInt("ai_embedding_batch_size", defaultAIEmbeddingBatchSize)
	if batchSize <= 0 {
		return defaultAIEmbeddingBatchSize
	}
	if batchSize > 64 {
		return 64
	}
	return batchSize
}

func getAIEmbeddingBackfillLimit() int {
	limit := web.AppConfig.DefaultInt("ai_embedding_backfill_limit", defaultAIEmbeddingBackfillLimit)
	if limit < 0 {
		return 0
	}
	return limit
}

func getAIEmbeddingTextLength() int {
	length := web.AppConfig.DefaultInt("ai_embedding_text_length", defaultAIEmbeddingTextLength)
	if length <= 0 {
		return defaultAIEmbeddingTextLength
	}
	return length
}

func getAIEmbeddingScoreWeight() float64 {
	weight, err := web.AppConfig.Float("ai_embedding_score_weight")
	if err != nil || weight <= 0 {
		return defaultAIEmbeddingScoreWeight
	}
	return weight
}

func getAIEmbeddingTimeout() time.Duration {
	seconds := web.AppConfig.DefaultInt("ai_embedding_timeout_sec", defaultAIRequestTimeoutSec)
	if seconds <= 0 {
		seconds = defaultAIRequestTimeoutSec
	}
	return time.Duration(seconds) * time.Second
}
