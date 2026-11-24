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
        const dates = ["12.02", "13.02", "14.02", "15.02", "16.02"];

        const initialData = {
            class: "5В",
            teacher,
            students,
            dates,
            subjects: {
                "Математика": { grades: {}, homework: "Подготовка к контрольной работе, выполнить задание из файла", tests: [] },
                "Русский язык": { grades: {}, homework: "Упражнение 154, выучить словарные слова", tests: [] },
                "Литература": { grades: {}, homework: "Выучить наизусть стихотворение М.Ю. Лермонтова 'Парус' (стр. 208).", tests: [] },
                "История": { grades: {}, homework: "Параграф 12", tests: [] },
                "Биология": { grades: {}, homework: "§ 24, вопросы устно", tests: [] },
                "География": { grades: {}, homework: "Нанести на контурную карту", tests: [] },
                "Труд": { grades: {}, homework: "Принести ткань", tests: [] },
                "Физкультура": { grades: {}, homework: "Комплекс упражнений", tests: [] }
            }
        };
        fs.writeFileSync(JOURNAL_FILE, JSON.stringify(initialData, null, 2));
    } else {
        const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
        let changed = false;
        if (data.students) {
            data.students.forEach(s => {
                if (s.password !== "123456") { s.password = "123456"; changed = true; }
            });
        }
        if (!data.dates) {
            data.dates = ["12.02", "13.02", "14.02", "15.02", "16.02"];
            changed = true;
        }
        if (changed) fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    }
}

app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Введите логин и пароль' });

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

app.get('/api/data', (req, res) => {
    const { role, studentId } = req.query;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));

    if (role === 'student') {
        if (!studentId) return res.status(400).json({ error: 'Не передан studentId' });
        const id = parseInt(studentId);
        const student = data.students.find(s => s.id === id);
        if (!student) return res.status(404).json({ error: 'Ученик не найден' });

        const filteredSubjects = {};
        for (const subject in data.subjects) {
            const subj = data.subjects[subject];
            const filteredGrades = {};
            for (const key in subj.grades) {
                if (key.startsWith(`${id}-`)) {
                    filteredGrades[key] = subj.grades[key];
                }
            }
            filteredSubjects[subject] = {
                grades: filteredGrades,
                homework: subj.homework,
                tests: subj.tests || []
            };
        }
        return res.json({
            class: data.class,
            student,
            students: [student],
            subjects: filteredSubjects,
            dates: data.dates || []
        });
    }

    res.json(data);
});

app.post('/api/date', (req, res) => {
    const { date, role } = req.body;
    if (role !== 'teacher') return res.status(403).json({ error: 'Доступ запрещен' });
    if (!date || !/^\d{2}\.\d{2}$/.test(date)) return res.status(400).json({ error: 'Неверный формат даты' });

    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    if (!data.dates) data.dates = [];
    if (data.dates.includes(date)) return res.status(400).json({ error: 'Такая дата уже существует' });
    
    data.dates.push(date);
    data.dates.sort((a, b) => {
        const [d1, m1] = a.split('.').map(Number);
        const [d2, m2] = b.split('.').map(Number);
        return (m1 * 100 + d1) - (m2 * 100 + d2);
    });
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, dates: data.dates });
});

app.post('/api/homework', (req, res) => {
    const { subject, text, role } = req.body;
    if (role !== 'teacher') return res.status(403).json({ error: 'Доступ запрещен' });

    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    if (data.subjects[subject]) {
        data.subjects[subject].homework = text;
        fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Предмет не найден' });
    }
});

app.post('/api/grade', (req, res) => {
    const { subject, studentId, date, grade, type, comment, theme, isDot, dueDate, role } = req.body;
    if (role !== 'teacher') return res.status(403).json({ error: 'Доступ запрещен' });

    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    if (!data.subjects[subject]) return res.status(404).json({ error: 'Предмет не найден' });
    
    const key = `${studentId}-${date}`;
    if (grade === null) {
        delete data.subjects[subject].grades[key];
    } else {
        data.subjects[subject].grades[key] = { grade, type, comment, theme: theme || '', isDot: isDot || false, dueDate: dueDate || null };
    }
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

app.post('/api/test', (req, res) => {
    const { subject, date, theme, action, role } = req.body;
    if (role !== 'teacher') return res.status(403).json({ error: 'Доступ запрещен' });
    if (action === 'add' && !theme) return res.status(400).json({ error: 'Введите тему' });

    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    if (!data.subjects[subject]) return res.status(404).json({ error: 'Предмет не найден' });

    const subjectData = data.subjects[subject];
    if (!subjectData.tests) subjectData.tests = [];

    if (action === 'add') {
        if (subjectData.tests.find(t => t.date === date)) return res.status(400).json({ error: 'Контрольная уже есть' });
        subjectData.tests.push({ date, theme, type: 'Контрольная работа' });
    } else if (action === 'remove') {
        subjectData.tests = subjectData.tests.filter(t => t.date !== date);
    }
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, tests: subjectData.tests });
});

initDB();
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
