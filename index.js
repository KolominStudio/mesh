const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080; 

const DATA_DIR = path.join(__dirname, 'data');
const JOURNAL_FILE = path.join(DATA_DIR, 'journal.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function initDB() {
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

        const students = studentNames.map((name, index) => ({
            id: index + 1,
            name,
            login: `student${index + 1}`,
            password: "123456"
        }));

        const teacher = { login: "Tim", password: "Px+j812ba1", name: "Тим Тимофеевич" };
        const datesList = ["12.02", "13.02", "14.02", "15.02", "16.02"];

        const initialData = {
            class: "5В",
            teacher,
            students,
            dates: datesList,
            subjects: {
                "Математика": { grades: {}, homework: "Повторить параграф 24", tests: [] },
                "Русский язык": { grades: {}, homework: "Упражнение 154", tests: [] },
                "Литература": { grades: {}, homework: "Прочитать главу 3", tests: [] },
                "История": { grades: {}, homework: "Параграф 12", tests: [] },
                "Биология": { grades: {}, homework: "§ 24, вопросы устно", tests: [] },
                "География": { grades: {}, homework: "Нанести на контурную карту", tests: [] },
                "Труд": { grades: {}, homework: "Принести ткань", tests: [] },
                "Физкультура": { grades: {}, homework: "Комплекс упражнений", tests: [] }
            }
        };
        fs.writeFileSync(JOURNAL_FILE, JSON.stringify(initialData, null, 2));
        console.log('✅ База данных создана.');
    }
}

// 1. Вход
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

// 2. Данные
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

// 3. СОХРАНЕНИЕ ОЦЕНКИ
app.post('/api/grade', (req, res) => {
    try {
        const { subject, studentId, date, grade, type, comment, theme, isDot, dueDate, role } = req.body;
        if (role !== 'teacher') return res.status(403).json({ error: 'Доступ запрещен' });

        const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
        const key = `${studentId}-${date}`;
        
        if (grade === null) {
            delete data.subjects[subject].grades[key];
        } else {
            data.subjects[subject].grades[key] = { grade: Number(grade), type, comment, theme, isDot, dueDate };
        }
        
        fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// 4. Домашнее задание
app.post('/api/homework', (req, res) => {
    const { subject, text, role } = req.body;
    if (role !== 'teacher') return res.status(403).json({ error: 'Доступ запрещен' });

    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    data.subjects[subject].homework = text;
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// 5. Даты
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

// 6. Контрольные
app.post('/api/test', (req, res) => {
    const { subject, date, theme, role } = req.body;
    if (role !== 'teacher') return res.status(403).json({ error: 'Доступ запрещен' });

    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    data.subjects[subject].tests.push({ date, theme, type: 'Контрольная работа' });
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, tests: data.subjects[subject].tests });
});

initDB();
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
