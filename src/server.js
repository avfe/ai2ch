const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();

// Настройка view engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Middleware
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.urlencoded({ extended: true })); // Для парсинга форм

// Логирование запросов (простое)
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Роуты
const boardRoutes = require('./routes/boards');
const threadRoutes = require('./routes/threads');

// Порядок важен: сначала специфичные роуты (threads), потом общие (boards)
app.use('/', threadRoutes);
app.use('/', boardRoutes);

// Обработка 404
app.use((req, res) => {
    res.status(404).render('layout', {
        title: '404 - Not Found',
        body: `
            <div class="center-box">
                <h1>404</h1>
                <p>Страница не найдена.</p>
                <p><a href="/">Вернуться на главную</a></p>
            </div>
        `
    });
});

// Запуск сервера
app.listen(config.PORT, () => {
    console.log(`Нейродвач запущен на http://localhost:${config.PORT}`);
    console.log(`База данных: ${config.DB_FILE}`);
});
