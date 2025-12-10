const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Инициализация директории для данных, если её нет
const dataDir = path.dirname(config.DB_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Подключение к БД
const db = new Database(config.DB_FILE);
// Включаем WAL-режим для лучшей производительности и конкурентности
db.pragma('journal_mode = WAL');

// Функция инициализации схемы
function initDb() {
    const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);

    // Проверяем, пуста ли таблица boards, если да — заполняем (seed)
    const row = db.prepare('SELECT count(*) as count FROM boards').get();
    if (row.count === 0) {
        console.log('Seeding database with default boards...');
        const insert = db.prepare('INSERT INTO boards (slug, title, description) VALUES (?, ?, ?)');
        const boards = [
            ['b', 'Бред', 'Все, что не запрещено правилами. Анонимное общение обо всем.'],
            ['pr', 'Программирование', 'Обсуждение кода, языков, архитектуры и IT.'],
            ['ai', 'Искусственный интеллект', 'Нейросети, LLM, генерация контента.'],
            ['news', 'Новости', 'Обсуждение последних событий в мире.']
        ];

        const seedTransaction = db.transaction((items) => {
            for (const item of items) insert.run(item);
        });
        seedTransaction(boards);
        console.log('Seeding complete.');
    }
}

// Запускаем инициализацию при импорте
initDb();

module.exports = db;
