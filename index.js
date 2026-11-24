const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; 

const DATA_DIR = path.join(__dirname, 'data');
const JOURNAL_FILE = path.join(DATA_DIR, 'journal.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Создаем базу при старте
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
    console.log('База данных создана.');
}

// --- API ---
app.post('/api/login', (req, res) => {
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    const { login, password } = req.body;

    if (data.teacher.login === login && data.teacher.password === password) {
        return res.json({ role: 'teacher', name: data.teacher.name });
    }
    const student = data.students.find(s => s.login === login && s.password === password);
    if (student) {
        return res.json({ role: 'student', name: student.name, id: student.id });
    }
    res.status(401).json({ error: 'Неверный логин или пароль' });
});

app.get('/api/data', (req, res) => {
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    const { role, studentId } = req.query;

    if (role === 'student') {
        const id = parseInt(studentId);
        const filteredSubjects = {};
        for (const subj in data.subjects) {
            const filteredGrades = {};
            for (const key in data.subjects[subj].grades) {
                if (key.startsWith(`${id}-`)) filteredGrades[key] = data.subjects[subj].grades[key];
            }
            filteredSubjects[subj] = { 
                grades: filteredGrades, 
                homework: data.subjects[subj].homework, 
                tests: data.subjects[subj].tests 
            };
        }
        return res.json({ ...data, students: data.students.filter(s => s.id === id), subjects: filteredSubjects });
    }
    res.json(data);
});

app.post('/api/grade', (req, res) => {
    const { subject, studentId, date, grade, type, comment, theme, role } = req.body;
    if (role !== 'teacher') return res.status(403).json({ error: 'Нет доступа' });

    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    const key = `${studentId}-${date}`;
    
    if (grade === null) delete data.subjects[subject].grades[key];
    else data.subjects[subject].grades[key] = { grade: Number(grade), type, comment, theme };
    
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

app.post('/api/homework', (req, res) => {
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    data.subjects[req.body.subject].homework = req.body.text;
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

app.post('/api/date', (req, res) => {
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    if (!data.dates.includes(req.body.date)) {
        data.dates.push(req.body.date);
        data.dates.sort((a, b) => {
            const [d1, m1] = a.split('.').map(Number);
            const [d2, m2] = b.split('.').map(Number);
            return (m1 * 100 + d1) - (m2 * 100 + d2);
        });
        fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    }
    res.json({ success: true, dates: data.dates });
});

app.listen(PORT, () => console.log(`СЕРВЕР ЗАПУЩЕН: http://localhost:${PORT}`));
