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

        // Генерируем расписание с 24.11.2026 по 25.05.2027 (по рабочим дням)
        const dates = [];
        let currentDate = new Date(2026, 10, 24); // 24 ноября 2026
        const endDate = new Date(2027, 4, 25); // 25 мая 2027

        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay(); // 0 = Вс, 1 = Пн...
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Пропускаем выходные
                const d = String(currentDate.getDate()).padStart(2, '0');
                const m = String(currentDate.getMonth() + 1).padStart(2, '0');
                dates.push(`${d}.${m}`);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const initialData = {
            class: "5В",
            teachers: [
                { id: 1, login: "Tim", password: "Px+j812ba1", name: "Тим Тимофеевич" }
            ],
            students: studentNames.map((name, i) => ({ id: i + 1, name, login: `student${i+1}`, password: "123456" })),
            dates: dates.slice(0, 20), // Берем первые 20 дат для демо-журнала
            scheduleDates: dates, // Полное расписание для вкладки "Расписание"
            subjects: {
                "Математика": { grades: {}, homework: "Повторить параграф 24", tests: [], teacherId: 1 },
                "Русский язык": { grades: {}, homework: "Упражнение 154", tests: [], teacherId: 1 },
                "Литература": { grades: {}, homework: "Прочитать главу 3", tests: [], teacherId: 1 },
                "История": { grades: {}, homework: "Параграф 12", tests: [], teacherId: 1 },
                "Биология": { grades: {}, homework: "§ 24, вопросы устно", tests: [], teacherId: 1 }
            },
            substitutions: [] // Замены уроков
        };
        fs.writeFileSync(JOURNAL_FILE, JSON.stringify(initialData, null, 2));
        console.log('✅ База данных создана.');
    }
}

// API Вход
app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));

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
        
        // Ученику отдаем оценки, ДЗ, и инфу о заменах
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
            class: data.class, 
            student, 
            students: [student], 
            subjects: filteredSubjects, 
            dates: data.dates || [],
            teachers: data.teachers,
            substitutions: data.substitutions
        });
    }

    // Учителю отдаем всё
    res.json(data);
});

// Сохранение оценки
app.post('/api/grade', (req, res) => {
    const { subject, studentId, date, grade, type, comment, theme, isDot, dueDate } = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    const key = `${studentId}-${date}`;
    
    if (grade === null) delete data.subjects[subject].grades[key];
    else data.subjects[subject].grades[key] = { grade: Number(grade), type, comment, theme, isDot, dueDate };
    
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// ДЗ
app.post('/api/homework', (req, res) => {
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    data.subjects[req.body.subject].homework = req.body.text;
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// Контрольная
app.post('/api/test', (req, res) => {
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    const subj = data.subjects[req.body.subject];
    if (!subj.tests) subj.tests = [];
    
    if (req.body.action === 'add') {
        if (!subj.tests.find(t => t.date === req.body.date)) subj.tests.push({ date: req.body.date, theme: req.body.theme, type: 'Контрольная работа' });
    } else if (req.body.action === 'remove') {
        subj.tests = subj.tests.filter(t => t.date !== req.body.date);
    }
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, tests: subj.tests });
});

// --- АДМИНИСТРИРОВАНИЕ ---

// Управление учениками
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
        // Очищаем оценки удаленного ученика
        for (const subj in data.subjects) {
            for (const key in data.subjects[subj].grades) {
                if (key.startsWith(`${studentId}-`)) delete data.subjects[subj].grades[key];
            }
        }
    }
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// Управление учителями
app.post('/api/admin/teacher', (req, res) => {
    const { action, teacherData, teacherId, currentTeacherId } = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));

    if (action === 'add') {
        const newId = data.teachers.length > 0 ? Math.max(...data.teachers.map(t => t.id)) + 1 : 1;
        data.teachers.push({ id: newId, name: teacherData.name, login: teacherData.login, password: teacherData.password });
    } else if (action === 'edit') {
        const t = data.teachers.find(t => t.id === teacherId);
        if (t) { t.name = teacherData.name; t.login = teacherData.login; t.password = teacherData.password; }
    } else if (action === 'delete') {
        if (data.teachers.length > 1) data.teachers = data.teachers.filter(t => t.id !== teacherId);
        else return res.status(400).json({ error: 'Нельзя удалить последнего учителя' });
    }
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// Изменение своего профиля
app.post('/api/admin/my-profile', (req, res) => {
    const { teacherId, newData } = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));
    const t = data.teachers.find(t => t.id === teacherId);
    if (t) {
        t.name = newData.name;
        t.login = newData.login;
        t.password = newData.password;
        fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true, updatedTeacher: t });
    } else res.status(404).json({ error: 'Учитель не найден' });
});

// Замены
app.post('/api/admin/substitution', (req, res) => {
    const { action, date, subject, newTeacherId } = req.body;
    const data = JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf-8'));

    if (action === 'add') {
        // Удаляем старую замену на этот урок, если есть
        data.substitutions = data.substitutions.filter(s => !(s.date === date && s.subject === subject));
        data.substitutions.push({ date, subject, newTeacherId });
    } else if (action === 'remove') {
        data.substitutions = data.substitutions.filter(s => !(s.date === date && s.subject === subject));
    }
    fs.writeFileSync(JOURNAL_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, substitutions: data.substitutions });
});

initDB();
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
