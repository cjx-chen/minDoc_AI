package segmenter

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"unicode"

	"github.com/beego/beego/v2/core/logs"
	"github.com/mindoc-org/mindoc/conf"
)

var (
	segmenterOnce        sync.Once
	stopWords            map[string]bool
	technicalTermPattern = regexp.MustCompile(`(?i)[a-z0-9][a-z0-9+#._/-]{1,63}`)
)

var techTermWhitelist = map[string]bool{
	"find": true, "top": true, "last": true, "more": true, "less": true,
	"who": true, "which": true, "done": true, "move": true, "give": true,
	"make": true, "take": true, "fill": true, "split": true, "cut": true,
	"go": true, "net": true, "next": true,
	"get": true, "put": true, "call": true, "show": true, "describe": true,
	"like":   true,
	"system": true, "volume": true, "name": true, "save": true, "keep": true,
	"re": true, "mine": true, "near": true, "fire": true, "front": true,
	"full": true, "empty": true, "computer": true, "detail": true, "part": true,
	"back": true, "down": true, "up": true, "bar": true, "round": true,
	"side": true, "bottom": true,
	"everything": true,
}

func getDictDir() string {
	return filepath.Join(conf.WorkingDirectory, "lib", "jieba")
}

func initSegmenter() {
	segmenterOnce.Do(func() {
		stopWords = loadStopWords(filepath.Join(getDictDir(), "stop_words.utf8"))
		logs.Info("segmenter initialized, stop words:", len(stopWords))
	})
}

func loadStopWords(filePath string) map[string]bool {
	sw := make(map[string]bool)
	f, err := os.Open(filePath)
	if err != nil {
		logs.Error("load stop words failed ->", err)
		return sw
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		word := strings.TrimSpace(scanner.Text())
		if word != "" {
			sw[strings.ToLower(word)] = true
		}
	}
	return sw
}

func Segment(text string) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return []string{}
	}

	initSegmenter()
	words := fallbackCut(text)

	result := make([]string, 0, len(words))
	for _, word := range words {
		word = strings.ToLower(strings.TrimSpace(word))
		if word == "" {
			continue
		}
		runes := []rune(word)
		if len(runes) == 1 && !unicode.IsLetter(runes[0]) && !unicode.IsDigit(runes[0]) {
			continue
		}
		if stopWords[word] && !techTermWhitelist[word] {
			continue
		}
		result = append(result, word)
	}

	for _, word := range extractTechnicalTerms(text) {
		if stopWords[word] && !techTermWhitelist[word] {
			continue
		}
		result = append(result, word)
	}

	return result
}

func fallbackCut(text string) []string {
	words := make([]string, 0)
	var ascii strings.Builder
	hanRunes := make([]rune, 0)

	flushASCII := func() {
		if ascii.Len() == 0 {
			return
		}
		words = append(words, strings.ToLower(ascii.String()))
		ascii.Reset()
	}
	flushHan := func() {
		if len(hanRunes) == 0 {
			return
		}
		for size := 1; size <= 3; size++ {
			if len(hanRunes) < size {
				break
			}
			for i := 0; i+size <= len(hanRunes); i++ {
				words = append(words, string(hanRunes[i:i+size]))
			}
		}
		hanRunes = hanRunes[:0]
	}

	for _, r := range text {
		switch {
		case unicode.Is(unicode.Han, r):
			flushASCII()
			hanRunes = append(hanRunes, r)
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			flushHan()
			ascii.WriteRune(unicode.ToLower(r))
		default:
			flushASCII()
			flushHan()
		}
	}
	flushASCII()
	flushHan()

	return words
}

func extractTechnicalTerms(text string) []string {
	matches := technicalTermPattern.FindAllString(text, -1)
	if len(matches) == 0 {
		return nil
	}

	result := make([]string, 0, len(matches))
	for _, match := range matches {
		word := strings.ToLower(strings.TrimSpace(match))
		if word == "" || len([]rune(word)) < 2 {
			continue
		}
		if !strings.ContainsAny(word, ".+#/_-") {
			continue
		}
		hasAlphaNumeric := false
		for _, r := range word {
			if unicode.IsLetter(r) || unicode.IsDigit(r) {
				hasAlphaNumeric = true
				break
			}
		}
		if hasAlphaNumeric {
			result = append(result, word)
		}
	}
	return result
}
