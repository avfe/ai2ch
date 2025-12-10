// Клиент для работы с Google Generative AI SDK
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const { GEMINI_SYSTEM_INSTRUCTION } = require('./systemPrompt');

// Разделитель для нескольких сгенерированных постов за один запрос
const AI_POST_SEPARATOR = '<!--NEURODVACH_SPLIT-->';

// Инициализация клиента, если ключ предоставлен
let aiClient = null;
if (config.GEMINI_API_KEY) {
    aiClient = new GoogleGenerativeAI(config.GEMINI_API_KEY);
} else {
    console.warn('WARNING: GEMINI_API_KEY is not set. AI replies will not work.');
}

/**
 * Генерирует ответ нейросети на основе контекста треда.
 * @param {Object} params
 * @param {string} params.boardSlug - Slug борды (например, 'b')
 * @param {string} params.boardTitle - Название борды
 * @param {string} params.threadTitle - Заголовок треда
 * @param {Array} params.posts - Массив постов { id, author_type, content }
 * @param {number} [params.replyCount=1] - Сколько постов нужно сгенерировать
 * @returns {Promise<string[]>} Тексты ответов
 */
async function generateRepliesForThread({ boardSlug, boardTitle, threadTitle, posts, replyCount = 1 }) {
    if (!aiClient) {
        return ['Системное сообщение: API ключ нейросети не настроен.'];
    }

    const normalizedReplyCount = clampReplyCount(replyCount);

    try {
        // Формируем текстовый промпт из истории постов
        let historyText = `Контекст:\nБорда: /${boardSlug}/ - ${boardTitle}\nТред: ${threadTitle}\n\n`;

        posts.forEach(p => {
            const author = p.author_type === 'user' ? 'Анон' : 'Нейросеть';
            historyText += `[Пост #${p.id} от ${author}]:\n${p.content}\n---\n`;
        });

        historyText += `
Твоя задача: написать следующий(-ие) пост(ы) в этот тред.
Нужно вернуть РОВНО ${normalizedReplyCount} самостоятельных постов без нумерации и служебных пометок.
Разделяй посты строго строкой "${AI_POST_SEPARATOR}" между ними. Не добавляй ничего после последнего поста.
Если отвечаешь на конкретный пост, указывай его номер через >>ID и при необходимости вставляй цитату из контекста отдельной строкой, начинающейся с ">".`;

        // Вызов API (новый SDK @google/generative-ai)
        const model = aiClient.getGenerativeModel({
            model: config.GEMINI_MODEL_ID,
            systemInstruction: { parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }] }
        });

        const response = await model.generateContent(historyText);
        const text = response.response.text() || '';

        const replies = text.split(AI_POST_SEPARATOR)
            .map(part => part.trim())
            .filter(Boolean);

        if (replies.length >= 1) {
            return replies.slice(0, normalizedReplyCount);
        }

        const fallback = text.trim() || '... (нейросеть промолчала)';
        return [fallback];

    } catch (error) {
        console.error('Gemini API Error:', error);
        return ['Не удалось получить ответ нейросети. Возможно, сервис перегружен или запрос отфильтрован.'];
    }
}

function clampReplyCount(value) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return 1;
    return Math.max(1, Math.min(parsed, 5));
}

module.exports = { generateRepliesForThread, clampReplyCount, AI_POST_SEPARATOR };
