const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; 

const DATA_DIR = path.join(__dirname, 'data');
const JOURNAL_FILE = path.join(DATA_DIR, 'journal.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация БД
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(JOURNAL_FILE)) {
    const studentNames = [
        "Абрамов Артем", "Белова Мария", "Волков Дмитрий", "Гусева Алина", "Дмитриев Иван",
        "Егорова София", "Жуков Максим", "Зайцева Полина", "Иванов Никита", "Козлов Алексей",
        "Лебедева Виктория", "Морозов Кирилл", "Новикова Ева", "Орлов Даниил", "Петрова Анастасия",
        "Романов Михаил", "Соколова Дарья", "Тихонов Арсений", "Устинова Ксения", "Фролов Егор",
        "Хохлова Валерия", "Царев Матвей", "Чернова Алиса", "Шишкин Лев", "Щукина Анна",
        "Яковлев Тимур", "Яковлева Есения", "Антонов Марк", "Борисова Варвара", "Виноградов Владислав"
    ];

    const initialData = {
        class: "5В",
        teacher: { login: "Tim", password: "Px+j812ba1", name: "Тим Тимофеевич" },
        students: studentNames.map((name, i) => ({ id: i + 1, name, login: `student${i+1}`, password: "123456" })),
        dates: ["12.02", "13.02", "14.02", "15.02", "16.02"],
        subjects: {}
    };

    ["Математика", "Русский язык", "Литература", "История", "Биология", "География", "Труд", "Физкультура"].forEach(subj => {
        initialData.subjects[subj] = { grades: {}, homework: "ДЗ не задано", tests: [] };
    });

    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(initialData, null, 2));
}

// API Вход
app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));

    if (data.teacher && data.teacher.login === login && data.teacher.password === password) {
        return res.json({ role: 'teacher', name: data.teacher.name, login: data.teacher.login });
    }
    const student = data.students.find(s => s.login === login && s.password === password);
    if (student) {
        return res.json({ role: 'student', name: student.name, id: student.id, login: student.login });
    }
    res.status(401).json({ error: 'Неверный логин или пароль' });
});

// API Данные
app.get('/api/data', (req, res) => {
    const { role, studentId } = req.query;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));

    if (role === 'student') {
        const id = parseInt(studentId);
        const student = data.students.find(s => s.id === id);
        if (!student) return res.status(404).json({ error: 'Ученик не найден' });

        const filteredSubjects = {};
        for (const subject in data.subjects) {
            const subj = data.subjects[subject];
            const filteredGrades = {};
            for (const key in subj.grades) {
                if (key.startsWith(`${id}-`)) filteredGrades[key] = subj.grades[key];
            }
            filteredSubjects[subject] = { grades: filteredGrades, homework: subj.homework, tests: subj.tests || [] };
        }
        return res.json({ class: data.class, student, students: [student], subjects: filteredSubjects, dates: data.dates || [] });
    }
    res.json(data);
});

// API Сохранение ОЦЕНКИ (ИСПРАВЛЕНО: сохраняем isDot и dueDate)
app.post('/api/grade', (req, res) => {
    try {
        const { subject, studentId, date, grade, type, comment, theme, isDot, dueDate, role } = req.body;
        if (role !== 'teacher') return res.status(403).json({ error: 'Доступ запрещен' });

        const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
        const key = `${studentId}-${date}`;
        
        if (grade === null) {
            delete data.subjects[subject].grades[key];
        } else {
            data.subjects[subject].grades[key] = { 
                grade: Number(grade), 
                type, 
                comment, 
                theme, 
                isDot: isDot || false,  // <--- СОХРАНЯЕМ ТОЧКУ
                dueDate: dueDate || null // <--- СОХРАНЯЕМ ДАТУ
            };
        }
        
        fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API ДЗ
app.post('/api/homework', (req, res) => {
    const { subject, text, role } = req.body;
    if (role !== 'teacher') return res.status(403).json({ error: 'Доступ запрещен' });

    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    data.subjects[subject].homework = text;
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// API Даты
app.post('/api/date', (req, res) => {
    const { date, role } = req.body;
    if (role !== 'teacher') return res.status(403).json({ error: 'Доступ запрещен' });
    
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    if (!data.dates.includes(date)) {
        data.dates.push(date);
        data.dates.sort((a, b) => {
            const [d1, m1] = a.split('.').map(Number);
            const [d2, m2] = b.split('.').map(Number);
            return (m1 * 100 + d1) - (m2 * 100 + d2);
        });
        fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    }
    res.json({ success: true, dates: data.dates });
});

// API Контрольные
app.post('/api/test', (req, res) => {
    const { subject, date, theme, role, action } = req.body;
    if (role !== 'teacher') return res.status(403).json({ error: 'Доступ запрещен' });

    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    const subj = data.subjects[subject];
    if (!subj.tests) subj.tests = [];

    if (action === 'add') {
        if (!subj.tests.find(t => t.date === date)) {
            subj.tests.push({ date, theme, type: 'Контрольная работа' });
        }
    } else if (action === 'remove') {
        subj.tests = subj.tests.filter(t => t.date !== date);
    }
    
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, tests: subj.tests });
});

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
