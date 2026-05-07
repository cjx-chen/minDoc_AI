-- MinDoc AI Q&A schema for MySQL deployments.
-- Default table prefix is `md_`. If your `db_prefix` is different, replace
-- `md_ai_knowledge_chunks` with `<your_prefix>ai_knowledge_chunks`.
--
-- This table stores intelligent Markdown document chunks used by the AI Q&A
-- retrieval step. No seed data is required; chunks are generated automatically
-- when documents are created/updated or lazily when the AI Q&A API is called.

CREATE TABLE IF NOT EXISTS `md_ai_knowledge_chunks` (
  `chunk_id` int(11) NOT NULL AUTO_INCREMENT,
  `document_id` int(11) NOT NULL,
  `book_id` int(11) NOT NULL,
  `chunk_index` int(11) NOT NULL DEFAULT 0,
  `chunk_title` varchar(500) NOT NULL DEFAULT '',
  `content` text NOT NULL,
  `content_md5` char(32) NOT NULL DEFAULT '',
  `word_count` int(11) NOT NULL DEFAULT 0,
  `create_time` datetime NOT NULL,
  `modify_time` datetime NOT NULL,
  PRIMARY KEY (`chunk_id`),
  KEY `idx_ai_chunks_document_id` (`document_id`),
  KEY `idx_ai_chunks_book_id` (`book_id`),
  KEY `idx_ai_chunks_chunk_index` (`chunk_index`),
  KEY `idx_ai_chunks_content_md5` (`content_md5`),
  KEY `idx_ai_chunks_doc_chunk` (`document_id`, `chunk_index`),
  KEY `idx_ai_chunks_modify_time` (`modify_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
