const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateRepliesForThread, clampReplyCount } = require('../gemini/client');

// GET /:boardSlug/thread/:threadId - Просмотр треда
router.get('/:boardSlug/thread/:threadId', (req, res, next) => {
    const { boardSlug, threadId } = req.params;

    const board = db.prepare('SELECT * FROM boards WHERE slug = ?').get(boardSlug);
    if (!board) return next();

    const thread = db.prepare('SELECT * FROM threads WHERE id = ? AND board_id = ?').get(threadId, board.id);
    if (!thread) return next();

    const posts = db.prepare('SELECT * FROM posts WHERE thread_id = ? ORDER BY id ASC').all(threadId);

    res.render('layout', { 
        title: thread.title, 
        content: 'thread',
        board, 
        thread, 
        posts 
    });
});

// POST /:boardSlug/thread/:threadId/reply - Ответ в тред
router.post('/:boardSlug/thread/:threadId/reply', async (req, res, next) => {
    const { boardSlug, threadId } = req.params;
    const { content, geminiApiKey, aiReplies, geminiModelId } = req.body;
    const replyCount = clampReplyCount(aiReplies);

    const board = db.prepare('SELECT * FROM boards WHERE slug = ?').get(boardSlug);
    if (!board) return next();

    const thread = db.prepare('SELECT * FROM threads WHERE id = ? AND board_id = ?').get(threadId, board.id);
    if (!thread) return next();

    if (!content || !content.trim()) {
        return res.redirect(`/${boardSlug}/thread/${threadId}`);
    }

    try {
        // Сохраняем пост пользователя
        db.prepare('INSERT INTO posts (thread_id, author_type, author_name, content) VALUES (?, ?, ?, ?)')
            .run(threadId, 'user', 'Анон', content);

        // Получаем все посты для контекста (включая только что добавленный)
        const allPosts = db.prepare('SELECT id, author_type, content FROM posts WHERE thread_id = ? ORDER BY id ASC').all(threadId);

        // Генерируем ответ AI
        const aiResponses = await generateRepliesForThread({
            boardSlug,
            boardTitle: board.title,
            threadTitle: thread.title,
            posts: allPosts,
            userApiKey: geminiApiKey,
            userModelId: geminiModelId,
            replyCount
        });

        // Сохраняем посты AI
        aiResponses.forEach(text => {
            db.prepare('INSERT INTO posts (thread_id, author_type, author_name, content) VALUES (?, ?, ?, ?)')
                .run(threadId, 'ai', 'Нейросеть', text);
        });

        // Обновляем время треда
        db.prepare('UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(threadId);

        res.redirect(`/${boardSlug}/thread/${threadId}`);

    } catch (err) {
        console.error("Reply error:", err);
        // Даже если AI упал, пост юзера сохранен.
        res.redirect(`/${boardSlug}/thread/${threadId}`);
    }
});

module.exports = router;
