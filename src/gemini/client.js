// Клиент для работы с Google Generative AI SDK
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const { GEMINI_SYSTEM_INSTRUCTION } = require('./systemPrompt');

const USER_MODEL_OPTIONS = ['gemini-flash-latest', 'gemini-3-pro-preview'];

// Инициализация клиента, если ключ предоставлен в переменных окружения
// Разделитель для нескольких сгенерированных постов за один запрос
const AI_POST_SEPARATOR = '<!--NEURODVACH_SPLIT-->';

// Инициализация клиента, если ключ предоставлен
let aiClient = null;
if (config.GEMINI_API_KEY) {
    aiClient = new GoogleGenerativeAI(config.GEMINI_API_KEY);
} else {
    console.warn('WARNING: GEMINI_API_KEY is not set. AI replies will not work.');
}

function getClient(userApiKey) {
    if (userApiKey && userApiKey.trim()) {
        return new GoogleGenerativeAI(userApiKey.trim());
    }
    return aiClient;
}

function getModelId(userApiKey, userModelId) {
    if (userApiKey && userApiKey.trim()) {
        if (userModelId && USER_MODEL_OPTIONS.includes(userModelId)) {
            return userModelId;
        }
        // Если ключ предоставлен, но модель не выбрана, используем быстрый вариант
        return USER_MODEL_OPTIONS[0];
    }
    return config.GEMINI_MODEL_ID;
}

/**
 * Генерирует ответ нейросети на основе контекста треда.
 * @param {Object} params
 * @param {string} params.boardSlug - Slug борды (например, 'b')
 * @param {string} params.boardTitle - Название борды
 * @param {string} params.threadTitle - Заголовок треда
 * @param {Array} params.posts - Массив постов { id, author_type, content }
 * @param {string} [params.userApiKey] - Пользовательский API ключ (если указан)
 * @param {string} [params.userModelId] - Предпочитаемая модель (если указан пользовательский ключ)
 * @returns {Promise<string>} Текст ответа
 */
async function generateRepliesForThread({ boardSlug, boardTitle, threadTitle, posts, userApiKey, userModelId, replyCount = 1 }) {
    const client = getClient(userApiKey);
    if (!client) {
        return 'Системное сообщение: API ключ нейросети не настроен.';
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
        const model = client.getGenerativeModel({
            model: getModelId(userApiKey, userModelId),
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
