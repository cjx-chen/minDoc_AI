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
  KEY `idx_ai_chunks_modify_time` (`modify_time`),
  FULLTEXT KEY `ft_ai_chunks_title_content` (`chunk_title`, `content`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- For an existing deployment where `md_ai_knowledge_chunks` was already created
-- before FULLTEXT support was added, run this manually once if the index is missing:
-- ALTER TABLE `md_ai_knowledge_chunks` ADD FULLTEXT KEY `ft_ai_chunks_title_content` (`chunk_title`, `content`);

-- Optional semantic vector cache for AI Q&A. This table stores embedding vectors
-- as JSON text so it works on ordinary MySQL deployments without a native vector
-- extension. Vectors are generated lazily when AI Q&A retrieval runs.
CREATE TABLE IF NOT EXISTS `md_ai_knowledge_embeddings` (
  `chunk_id` int(11) NOT NULL,
  `document_id` int(11) NOT NULL,
  `book_id` int(11) NOT NULL,
  `content_md5` char(32) NOT NULL DEFAULT '',
  `embedding_model` varchar(128) NOT NULL DEFAULT '',
  `embedding_dim` int(11) NOT NULL DEFAULT 0,
  `embedding` longtext NOT NULL,
  `create_time` datetime NOT NULL,
  `modify_time` datetime NOT NULL,
  PRIMARY KEY (`chunk_id`),
  KEY `idx_ai_embedding_document_id` (`document_id`),
  KEY `idx_ai_embedding_book_id` (`book_id`),
  KEY `idx_ai_embedding_content_md5` (`content_md5`),
  KEY `idx_ai_embedding_model` (`embedding_model`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
