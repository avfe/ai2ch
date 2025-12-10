const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateRepliesForThread, clampReplyCount } = require('../gemini/client');

// GET / - Список всех борд
router.get('/', (req, res) => {
    const boards = db.prepare('SELECT * FROM boards ORDER BY id').all();
    res.render('layout', { title: 'Главная', content: 'index', boards });
});

// GET /:boardSlug/ - Просмотр борды и списка тредов
router.get('/:boardSlug', (req, res, next) => {
    const { boardSlug } = req.params;

    // Ищем борду
    const board = db.prepare('SELECT * FROM boards WHERE slug = ?').get(boardSlug);
    if (!board) return next();

    // Выбираем треды и считаем количество постов
    const threads = db.prepare(`
        SELECT t.*, count(p.id) as post_count 
        FROM threads t 
        LEFT JOIN posts p ON p.thread_id = t.id 
        WHERE t.board_id = ? 
        GROUP BY t.id 
        ORDER BY t.updated_at DESC
    `).all(board.id);

    res.render('layout', { title: board.title, content: 'board', board, threads });
});

// POST /:boardSlug/thread - Создание нового треда
router.post('/:boardSlug/thread', async (req, res, next) => {
    const { boardSlug } = req.params;
    const { title, content, aiReplies } = req.body;
    const replyCount = clampReplyCount(aiReplies);

    const board = db.prepare('SELECT * FROM boards WHERE slug = ?').get(boardSlug);
    if (!board) return next();

    if (!title || !content || !content.trim()) {
        return res.status(400).send("Заголовок и текст обязательны!");
    }

    try {
        // Транзакция создания треда и первого поста
        let threadId;
        const createTx = db.transaction(() => {
            const threadResult = db.prepare('INSERT INTO threads (board_id, title) VALUES (?, ?)')
                .run(board.id, title);
            threadId = threadResult.lastInsertRowid;

            db.prepare('INSERT INTO posts (thread_id, author_type, author_name, content) VALUES (?, ?, ?, ?)')
                .run(threadId, 'user', 'Анон', content);

            return threadId;
        });

        createTx();

        // Контекст для AI: только что созданный пост
        const allPosts = db.prepare('SELECT id, author_type, content FROM posts WHERE thread_id = ? ORDER BY id ASC').all(threadId);

        const aiResponses = await generateRepliesForThread({
            boardSlug,
            boardTitle: board.title,
            threadTitle: title,
            posts: allPosts,
            replyCount
        });

        // Сохраняем ответы AI
        aiResponses.forEach(text => {
            db.prepare('INSERT INTO posts (thread_id, author_type, author_name, content) VALUES (?, ?, ?, ?)')
                .run(threadId, 'ai', 'Нейросеть', text);
        });

        // Обновляем updated_at у треда
        db.prepare('UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(threadId);

        res.redirect(`/${boardSlug}/thread/${threadId}`);

    } catch (err) {
        console.error("Error creating thread:", err);
        res.status(500).send("Ошибка при создании треда.");
    }
});

module.exports = router;
