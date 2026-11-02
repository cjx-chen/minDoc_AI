package models

import (
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/beego/beego/v2/client/orm"
	"github.com/beego/beego/v2/core/logs"
	"github.com/beego/beego/v2/server/web"
	"github.com/mindoc-org/mindoc/conf"
)

// WebLink 知识库外链：收藏外部网页并自动捕获页面信息（标题/描述/图标/封面图/正文快照）
type WebLink struct {
	LinkId        int        `orm:"pk;auto;unique;column(link_id)" json:"link_id"`
	BookId        int        `orm:"column(book_id);type(int);default(0);index" json:"book_id"`
	Url           string     `orm:"column(url);type(text)" json:"url"`
	UrlMd5        string     `orm:"column(url_md5);size(32);index" json:"-"`
	Title         string     `orm:"column(title);size(500)" json:"title"`
	Description   string     `orm:"column(description);size(2000)" json:"description"`
	IconUrl       string     `orm:"column(icon_url);size(1000)" json:"icon_url"`
	ImageUrl      string     `orm:"column(image_url);size(1000)" json:"image_url"`
	SiteName      string     `orm:"column(site_name);size(255)" json:"site_name"`
	Lang          string     `orm:"column(lang);size(35)" json:"lang"`
	LinkType      string     `orm:"column(link_type);size(32);default(external)" json:"link_type"`
	Content       string     `orm:"column(content);type(text)" json:"content"`
	Author        string     `orm:"column(author);size(255)" json:"author"`
	PublishedAt   *time.Time `orm:"column(published_at);type(datetime);null" json:"published_at"`
	Tags          string     `orm:"column(tags);size(500)" json:"tags"`
	Note          string     `orm:"column(note);type(text)" json:"note"`
	Pinned        int        `orm:"column(pinned);type(int);default(0);index" json:"pinned"`
	WordCount     int        `orm:"column(word_count);type(int);default(0)" json:"word_count"`
	Sort          int        `orm:"column(sort);type(int);default(0);index" json:"sort"`
	Status        int        `orm:"column(status);type(int);default(0)" json:"status"`
	CreatedBy     int        `orm:"column(created_by);type(int);default(0)" json:"created_by"`
	CreatedByName string     `orm:"column(created_by_name);size(255)" json:"created_by_name"`
	CreateTime    time.Time  `orm:"column(create_time);type(datetime);auto_now_add" json:"create_time"`
	ModifyTime    time.Time  `orm:"column(modify_time);type(datetime);auto_now" json:"modify_time"`
}

// NewWebLink 创建空实例
func NewWebLink() *WebLink {
	return &WebLink{}
}

// TableName 表名（带配置前缀）
func (item *WebLink) TableName() string {
	return "web_links"
}

// TableEngine 存储引擎
func (item *WebLink) TableEngine() string {
	return "INNODB"
}

// TableNameWithPrefix 带前缀表名
func (item *WebLink) TableNameWithPrefix() string {
	return conf.GetDatabasePrefix() + item.TableName()
}

// EnsureWebLinkTable 建表（幂等）。优先按适配器选择 DDL，失败时回退另一种方言，
// 避免个别环境下 db_adapter 读取异常导致建表失败。
func EnsureWebLinkTable() error {
	table := NewWebLink().TableNameWithPrefix()
	adapter, _ := web.AppConfig.String("db_adapter")
	adapter = strings.ToLower(strings.TrimSpace(adapter))

	var sql string
	if adapter == "sqlite3" || adapter == "sqlite" {
		sql = webLinkSQLiteDDL(table)
	} else {
		sql = webLinkMySQLDDL(table)
	}
	if _, err := orm.NewOrm().Raw(sql).Exec(); err != nil {
		// 回退：换另一种方言重试（如 sqlite 误走 mysql 分支）
		fallback := webLinkSQLiteDDL(table)
		if sql == fallback {
			fallback = webLinkMySQLDDL(table)
		}
		if _, err2 := orm.NewOrm().Raw(fallback).Exec(); err2 != nil {
			return err
		}
	}
	// 为首发后新增的列做幂等升级
	ensureWebLinkColumns(table)
	return nil
}

// webLinkSQLiteDDL SQLite 建表语句
func webLinkSQLiteDDL(table string) string {
	return "CREATE TABLE IF NOT EXISTS `" + table + "` (" +
		"`link_id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT," +
		"`book_id` INTEGER NOT NULL DEFAULT 0," +
		"`url` TEXT NOT NULL DEFAULT ''," +
		"`url_md5` CHAR(32) NOT NULL DEFAULT ''," +
		"`title` VARCHAR(500) NOT NULL DEFAULT ''," +
		"`description` VARCHAR(2000) NOT NULL DEFAULT ''," +
		"`icon_url` VARCHAR(1000) NOT NULL DEFAULT ''," +
		"`image_url` VARCHAR(1000) NOT NULL DEFAULT ''," +
		"`site_name` VARCHAR(255) NOT NULL DEFAULT ''," +
		"`lang` VARCHAR(35) NOT NULL DEFAULT ''," +
		"`link_type` VARCHAR(32) NOT NULL DEFAULT 'external'," +
		"`content` TEXT," +
		"`author` VARCHAR(255) NOT NULL DEFAULT ''," +
		"`published_at` DATETIME," +
		"`tags` VARCHAR(500) NOT NULL DEFAULT ''," +
		"`note` TEXT," +
		"`pinned` INTEGER NOT NULL DEFAULT 0," +
		"`word_count` INTEGER NOT NULL DEFAULT 0," +
		"`sort` INTEGER NOT NULL DEFAULT 0," +
		"`status` INTEGER NOT NULL DEFAULT 0," +
		"`created_by` INTEGER NOT NULL DEFAULT 0," +
		"`created_by_name` VARCHAR(255) NOT NULL DEFAULT ''," +
		"`create_time` DATETIME NOT NULL," +
		"`modify_time` DATETIME NOT NULL" +
		");" +
		"CREATE UNIQUE INDEX IF NOT EXISTS `uk_web_link_book_url` ON `" + table + "` (`book_id`,`url_md5`);" +
		"CREATE INDEX IF NOT EXISTS `idx_web_link_sort` ON `" + table + "` (`sort`)"
}

// webLinkMySQLDDL MySQL 建表语句
func webLinkMySQLDDL(table string) string {
	return "CREATE TABLE IF NOT EXISTS `" + table + "` (" +
		"`link_id` int(11) NOT NULL AUTO_INCREMENT," +
		"`book_id` int(11) NOT NULL DEFAULT '0'," +
		"`url` varchar(1000) NOT NULL DEFAULT ''," +
		"`url_md5` char(32) NOT NULL DEFAULT ''," +
		"`title` varchar(500) NOT NULL DEFAULT ''," +
		"`description` varchar(2000) NOT NULL DEFAULT ''," +
		"`icon_url` varchar(1000) NOT NULL DEFAULT ''," +
		"`image_url` varchar(1000) NOT NULL DEFAULT ''," +
		"`site_name` varchar(255) NOT NULL DEFAULT ''," +
		"`lang` varchar(35) NOT NULL DEFAULT ''," +
		"`link_type` varchar(32) NOT NULL DEFAULT 'external'," +
		"`content` longtext," +
		"`author` varchar(255) NOT NULL DEFAULT ''," +
		"`published_at` datetime DEFAULT NULL," +
		"`tags` varchar(500) NOT NULL DEFAULT ''," +
		"`note` text," +
		"`pinned` int(11) NOT NULL DEFAULT '0'," +
		"`word_count` int(11) NOT NULL DEFAULT '0'," +
		"`sort` int(11) NOT NULL DEFAULT '0'," +
		"`status` int(11) NOT NULL DEFAULT '0'," +
		"`created_by` int(11) NOT NULL DEFAULT '0'," +
		"`created_by_name` varchar(255) NOT NULL DEFAULT ''," +
		"`create_time` datetime NOT NULL," +
		"`modify_time` datetime NOT NULL," +
		"PRIMARY KEY (`link_id`)," +
		"UNIQUE KEY `uk_web_link_book_url` (`book_id`,`url_md5`)," +
		"KEY `idx_web_link_book_id` (`book_id`)," +
		"KEY `idx_web_link_sort` (`sort`)," +
		"KEY `idx_web_link_pinned` (`pinned`)" +
		") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci"
}

// webLinkAddedColumns 首发版本之后新增的列（用于幂等 ALTER 升级已有表）
var webLinkAddedColumns = []struct {
	name   string
	mysql  string
	sqlite string
}{
	{"content", "ADD COLUMN `content` longtext", "ADD COLUMN `content` TEXT"},
	{"author", "ADD COLUMN `author` varchar(255) NOT NULL DEFAULT ''", "ADD COLUMN `author` VARCHAR(255) NOT NULL DEFAULT ''"},
	{"lang", "ADD COLUMN `lang` varchar(35) NOT NULL DEFAULT ''", "ADD COLUMN `lang` VARCHAR(35) NOT NULL DEFAULT ''"},
	{"published_at", "ADD COLUMN `published_at` datetime DEFAULT NULL", "ADD COLUMN `published_at` DATETIME"},
	{"tags", "ADD COLUMN `tags` varchar(500) NOT NULL DEFAULT ''", "ADD COLUMN `tags` VARCHAR(500) NOT NULL DEFAULT ''"},
	{"note", "ADD COLUMN `note` text", "ADD COLUMN `note` TEXT"},
	{"pinned", "ADD COLUMN `pinned` int(11) NOT NULL DEFAULT '0'", "ADD COLUMN `pinned` INTEGER NOT NULL DEFAULT 0"},
	{"word_count", "ADD COLUMN `word_count` int(11) NOT NULL DEFAULT '0'", "ADD COLUMN `word_count` INTEGER NOT NULL DEFAULT 0"},
}

// webLinkColumnsEnsureOnce 保证列升级每个进程只执行一次（避免每请求重复 ALTER 产生日志噪音）
var webLinkColumnsEnsureOnce sync.Once

// ensureWebLinkColumns 为已有表幂等补齐新增列（重复列错误忽略；每进程仅执行一次）
func ensureWebLinkColumns(table string) {
	webLinkColumnsEnsureOnce.Do(func() {
		adapter, _ := web.AppConfig.String("db_adapter")
		isSQLite := strings.EqualFold(strings.TrimSpace(adapter), "sqlite3") || strings.EqualFold(strings.TrimSpace(adapter), "sqlite")
		o := orm.NewOrm()
		for _, col := range webLinkAddedColumns {
			clause := col.mysql
			if isSQLite {
				clause = col.sqlite
			}
			if _, err := o.Raw("ALTER TABLE `" + table + "` " + clause).Exec(); err != nil {
				// 列已存在等情况属正常，仅调试级忽略
				logs.Debug("alter web_links column skipped ->", col.name, err)
			}
		}
	})
}

// Find 按主键查询
func (item *WebLink) Find(linkId int) (*WebLink, error) {
	if linkId <= 0 {
		return nil, ErrInvalidParameter
	}
	o := orm.NewOrm()
	if err := EnsureWebLinkTable(); err != nil {
		logs.Warn("ensure web_links table failed ->", err)
	}
	var link WebLink
	err := o.QueryTable(item.TableNameWithPrefix()).Filter("link_id", linkId).One(&link)
	if err != nil {
		return nil, err
	}
	return &link, nil
}

// FindByURL 按 book_id + url 查询（走 url_md5 索引，用于去重）
func (item *WebLink) FindByURL(bookId int, rawURL string) (*WebLink, error) {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return nil, ErrInvalidParameter
	}
	o := orm.NewOrm()
	if err := EnsureWebLinkTable(); err != nil {
		logs.Warn("ensure web_links table failed ->", err)
	}
	var link WebLink
	err := o.QueryTable(item.TableNameWithPrefix()).
		Filter("book_id", bookId).
		Filter("url_md5", md5Text(rawURL)).
		One(&link)
	if err != nil {
		return nil, err
	}
	return &link, nil
}

// Insert 插入
func (item *WebLink) Insert() error {
	if strings.TrimSpace(item.Url) == "" {
		return ErrInvalidParameter
	}
	o := orm.NewOrm()
	if err := EnsureWebLinkTable(); err != nil {
		return err
	}
	item.normalize()
	item.LinkId = 0
	_, err := o.Insert(item)
	return err
}

// normalize 入库前按列宽截断，防止超长捕获值导致严格模式插入失败
func (item *WebLink) normalize() {
	item.Url = truncateString(item.Url, 1000)
	item.UrlMd5 = md5Text(item.Url)
	item.Title = truncateString(item.Title, 500)
	item.Description = truncateString(item.Description, 2000)
	item.IconUrl = truncateString(item.IconUrl, 1000)
	item.ImageUrl = truncateString(item.ImageUrl, 1000)
	item.SiteName = truncateString(item.SiteName, 255)
	item.LinkType = truncateString(item.LinkType, 32)
	item.CreatedByName = truncateString(item.CreatedByName, 255)
	item.Tags = truncateString(NormalizeWebLinkTags(item.Tags), 500)
	item.Note = truncateString(item.Note, 8000)
	item.Author = truncateString(item.Author, 255)
	item.Lang = truncateString(item.Lang, 35)
	if item.LinkType == "" {
		item.LinkType = "external"
	}
	if item.Pinned != 1 {
		item.Pinned = 0
	}
}

// TagList 解析标签为列表（逗号/中文逗号/空格分隔，去重保序）
func (item *WebLink) TagList() []string {
	return SplitWebLinkTags(item.Tags)
}

// NormalizeWebLinkTags 标准化标签字符串（统一逗号分隔、去重）
func NormalizeWebLinkTags(raw string) string {
	tags := SplitWebLinkTags(raw)
	return strings.Join(tags, ",")
}

// SplitWebLinkTags 拆分标签（逗号/中文逗号/分号/空格分隔，去重保序，单个限长 50）
func SplitWebLinkTags(raw string) []string {
	raw = strings.ReplaceAll(raw, "，", ",")
	raw = strings.ReplaceAll(raw, "；", ",")
	raw = strings.ReplaceAll(raw, ";", ",")
	raw = strings.ReplaceAll(raw, "\n", ",")
	raw = strings.ReplaceAll(raw, " ", ",")
	seen := make(map[string]bool)
	result := make([]string, 0, 4)
	for _, tag := range strings.Split(raw, ",") {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		tag = truncateString(tag, 50)
		key := strings.ToLower(tag)
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, tag)
		if len(result) >= 12 {
			break
		}
	}
	return result
}

// Update 更新（整行）
func (item *WebLink) Update() error {
	if item.LinkId <= 0 {
		return ErrInvalidParameter
	}
	o := orm.NewOrm()
	if err := EnsureWebLinkTable(); err != nil {
		return err
	}
	_, err := o.Update(item)
	return err
}

// Delete 删除
func (item *WebLink) Delete() error {
	if item.LinkId <= 0 {
		return ErrInvalidParameter
	}
	o := orm.NewOrm()
	if err := EnsureWebLinkTable(); err != nil {
		return err
	}
	_, err := o.Delete(item)
	return err
}

// WebLinkQuery 列表查询条件
type WebLinkQuery struct {
	BookId  int
	Keyword string
	Offset  int
	Limit   int
}

// FindLinks 分页查询外链，返回列表与总数
func (item *WebLink) FindLinks(query WebLinkQuery) ([]*WebLink, int64, error) {
	o := orm.NewOrm()
	if err := EnsureWebLinkTable(); err != nil {
		return nil, 0, err
	}
	cond := orm.NewCondition().And("status", 0)
	if query.BookId > 0 {
		cond = cond.And("book_id", query.BookId)
	}
	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		kw := orm.NewCondition().
			Or("title__icontains", keyword).
			Or("description__icontains", keyword).
			Or("url__icontains", keyword).
			Or("site_name__icontains", keyword).
			Or("tags__icontains", keyword).
			Or("note__icontains", keyword)
		cond = cond.AndCond(kw)
	}
	qs := o.QueryTable(item.TableNameWithPrefix()).SetCond(cond)
	total, err := qs.Count()
	if err != nil {
		return nil, 0, err
	}
	if query.Offset > 0 {
		qs = qs.Offset(query.Offset)
	}
	if query.Limit > 0 {
		qs = qs.Limit(query.Limit)
	}
	var links []*WebLink
	if _, err := qs.OrderBy("-pinned", "-sort", "-link_id").All(&links); err != nil {
		return nil, 0, err
	}
	return links, total, nil
}

// FindTags 汇总范围内出现过的标签（按出现次数倒序，供前端筛选）
func (item *WebLink) FindTags(bookId int) ([]string, error) {
	o := orm.NewOrm()
	if err := EnsureWebLinkTable(); err != nil {
		return nil, err
	}
	cond := orm.NewCondition().And("status", 0)
	if bookId > 0 {
		cond = cond.And("book_id", bookId)
	}
	var links []*WebLink
	if _, err := o.QueryTable(item.TableNameWithPrefix()).SetCond(cond).
		Limit(1000).OrderBy("-link_id").All(&links, "Tags"); err != nil {
		return nil, err
	}
	counts := make(map[string]int)
	order := make([]string, 0, 16)
	for _, link := range links {
		for _, tag := range link.TagList() {
			if counts[tag] == 0 {
				order = append(order, tag)
			}
			counts[tag]++
		}
	}
	sort.SliceStable(order, func(i, j int) bool {
		if counts[order[i]] != counts[order[j]] {
			return counts[order[i]] > counts[order[j]]
		}
		return order[i] < order[j]
	})
	if len(order) > 30 {
		order = order[:30]
	}
	return order, nil
}
