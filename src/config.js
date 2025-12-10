// Модуль конфигурации для удобного доступа к переменным окружения
require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 3000,
    DB_FILE: process.env.DATABASE_FILE || './data/neurodvach.sqlite',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL_ID: process.env.GEMINI_MODEL_ID || 'gemini-2.5-flash'
};
