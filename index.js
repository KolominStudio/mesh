const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; 

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

        // Генерируем ВСЕ даты (по будням) с 24.11.2026 по 25.05.2027
        const columns = [];
        let currentDate = new Date(2026, 10, 24);
        const endDate = new Date(2027, 4, 25);
        let colId = 1;

        while (currentDate <= endDate) {
            const day = currentDate.getDay();
            if (day !== 0 && day !== 6) { 
                const d = String(currentDate.getDate()).padStart(2, '0');
                const m = String(currentDate.getMonth() + 1).padStart(2, '0');
                columns.push({ id: colId++, date: `${d}.${m}`, type: 'Урок', theme: '' });
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const initialData = {
            class: "5В",
            teachers: [{ id: 1, login: "Tim", password: "Px+j812ba1", name: "Тим Тимофеевич" }],
            students: studentNames.map((name, i) => ({ id: i + 1, name, login: `student${i+1}`, password: "123456" })),
            columns: columns, 
            subjects: {
                "Математика": { grades: {}, homework: "Повторить параграф 24", tests: [], teacherId: 1 },
                "Русский язык": { grades: {}, homework: "Упражнение 154", tests: [], teacherId: 1 },
                "Литература": { grades: {}, homework: "Прочитать главу 3", tests: [], teacherId: 1 },
                "История": { grades: {}, homework: "Параграф 12", tests: [], teacherId: 1 },
                "Биология": { grades: {}, homework: "§ 24, вопросы устно", tests: [], teacherId: 1 }
            },
            substitutions: [] 
        };
        fs.writeFileSync(JOURNAL_FILE, JSON.stringify(initialData, null, 2));
    }
}

// API Вход
app.post('/api/login', (req, res) => {
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    const { login, password } = req.body;

    const teacher = data.teachers.find(t => t.login === login && t.password === password);
    if (teacher) return res.json({ role: 'teacher', name: teacher.name, id: teacher.id, login: teacher.login });

    const student = data.students.find(s => s.login === login && s.password === password);
    if (student) return res.json({ role: 'student', name: student.name, id: student.id, login: student.login });

    res.status(401).json({ error: 'Неверный логин или пароль' });
});

// Получить данные
app.get('/api/data', (req, res) => {
    const { role, studentId } = req.query;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));

    if (role === 'student') {
        const id = parseInt(studentId);
        const student = data.students.find(s => s.id === id);
        
        const filteredSubjects = {};
        for (const subject in data.subjects) {
            const subj = data.subjects[subject];
            const filteredGrades = {};
            for (const key in subj.grades) {
                if (key.startsWith(`${id}-`)) filteredGrades[key] = subj.grades[key];
            }
            filteredSubjects[subject] = { grades: filteredGrades, homework: subj.homework, tests: subj.tests || [], teacherId: subj.teacherId };
        }
        return res.json({ 
            class: data.class, student, students: [student], subjects: filteredSubjects, 
            columns: data.columns || [], teachers: data.teachers, substitutions: data.substitutions
        });
    }
    res.json(data);
});

// Сохранение оценки
app.post('/api/grade', (req, res) => {
    const { subject, studentId, columnId, grade, comment, theme } = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    const key = `${studentId}-${columnId}`;
    
    if (grade === null) delete data.subjects[subject].grades[key];
    else data.subjects[subject].grades[key] = { grade: Number(grade), comment, theme };
    
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// Добавление нового столбца (доп. работы)
app.post('/api/column', (req, res) => {
    const { date, type, theme, hw } = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    
    const newId = data.columns.length > 0 ? Math.max(...data.columns.map(c => c.id)) + 1 : 1;
    data.columns.push({ id: newId, date, type, theme });
    
    data.columns.sort((a, b) => {
        const [d1, m1] = a.date.split('.').map(Number);
        const [d2, m2] = b.date.split('.').map(Number);
        return (m1 * 100 + d1) - (m2 * 100 + d2);
    });

    if (hw) data.subjects[req.body.subject].homework = hw;
    if (type === 'Контрольная работа') {
        const subj = data.subjects[req.body.subject];
        if (!subj.tests) subj.tests = [];
        if (!subj.tests.find(t => t.date === date)) subj.tests.push({ date, theme: theme || 'Контрольная', type: 'Контрольная работа' });
    }

    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, columns: data.columns });
});

// Управление ДЗ и контрольными (для клика по дате)
app.post('/api/date-settings', (req, res) => {
    const { date, hw, isTest, testTheme, subject } = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    const subj = data.subjects[subject];

    if (hw !== undefined) subj.homework = hw;

    if (isTest !== undefined) {
        if (!subj.tests) subj.tests = [];
        if (isTest && testTheme) {
            if (!subj.tests.find(t => t.date === date)) subj.tests.push({ date, theme: testTheme, type: 'Контрольная работа' });
        } else if (!isTest) {
            subj.tests = subj.tests.filter(t => t.date !== date);
        }
    }

    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// Замены
app.post('/api/admin/substitution', (req, res) => {
    const { action, date, subject, newTeacherId } = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));

    if (action === 'add') {
        data.substitutions = data.substitutions.filter(s => !(s.date === date && s.subject === subject));
        data.substitutions.push({ date, subject, newTeacherId: Number(newTeacherId) });
    } else if (action === 'remove') {
        data.substitutions = data.substitutions.filter(s => !(s.date === date && s.subject === subject));
    }
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, substitutions: data.substitutions });
});

// Остальные API (ученики, учителя) оставляем как были...
app.post('/api/admin/student', (req, res) => {
    const { action, studentData, studentId } = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    if (action === 'add') {
        const newId = data.students.length > 0 ? Math.max(...data.students.map(s => s.id)) + 1 : 1;
        data.students.push({ id: newId, name: studentData.name, login: studentData.login, password: studentData.password });
    } else if (action === 'edit') {
        const s = data.students.find(s => s.id === studentId);
        if (s) { s.name = studentData.name; s.login = studentData.login; s.password = studentData.password; }
    } else if (action === 'delete') {
        data.students = data.students.filter(s => s.id !== studentId);
    }
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

app.post('/api/admin/teacher', (req, res) => {
    const { action, teacherData, teacherId } = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    if (action === 'add') {
        const newId = data.teachers.length > 0 ? Math.max(...data.teachers.map(t => t.id)) + 1 : 1;
        data.teachers.push({ id: newId, name: teacherData.name, login: teacherData.login, password: teacherData.password });
    } else if (action === 'edit') {
        const t = data.teachers.find(t => t.id === teacherId);
        if (t) { t.name = teacherData.name; t.login = teacherData.login; t.password = teacherData.password; }
    } else if (action === 'delete') {
        if (data.teachers.length > 1) data.teachers = data.teachers.filter(t => t.id !== teacherId);
    }
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

app.post('/api/admin/my-profile', (req, res) => {
    const { teacherId, newData } = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    const t = data.teachers.find(t => t.id === teacherId);
    if (t) {
        t.name = newData.name; t.login = newData.login; t.password = newData.password;
        fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true, updatedTeacher: t });
    }
});

initDB();
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
