// Клиент для работы с Google Generative AI SDK
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const { GEMINI_SYSTEM_INSTRUCTION } = require('./systemPrompt');

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
 * @returns {Promise<string>} Текст ответа
 */
async function generateReplyForThread({ boardSlug, boardTitle, threadTitle, posts }) {
    if (!aiClient) {
        return 'Системное сообщение: API ключ нейросети не настроен.';
    }

    try {
        // Формируем текстовый промпт из истории постов
        let historyText = `Контекст:\nБорда: /${boardSlug}/ - ${boardTitle}\nТред: ${threadTitle}\n\n`;

        // Берем последние 20 постов, чтобы не перегружать контекст
        const relevantPosts = posts.slice(-20);

        relevantPosts.forEach(p => {
            const author = p.author_type === 'user' ? 'Анон' : 'Нейросеть';
            historyText += `[Пост #${p.id} от ${author}]:\n${p.content}\n---\n`;
        });

        historyText += `\nТвоя задача: Написать следующий пост в этот тред.`;

        // Вызов API (новый SDK @google/generative-ai)
        const model = aiClient.getGenerativeModel({
            model: config.GEMINI_MODEL_ID,
            systemInstruction: { parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }] }
        });

        const response = await model.generateContent(historyText);
        const text = response.response.text();
        return text || '... (нейросеть промолчала)';

    } catch (error) {
        console.error('Gemini API Error:', error);
        return 'Не удалось получить ответ нейросети. Возможно, сервис перегружен или запрос отфильтрован.';
    }
}

module.exports = { generateReplyForThread };
