// In-browser SQLite demo database ("College ERP") used for execution of generated SQL.
import initSqlJs from 'sql.js/dist/sql-asm.js'

export type Column = { name: string; type: string; pk?: boolean; fk?: string; synonyms: string[] }
export type Table = { name: string; synonyms: string[]; columns: Column[] }

export const SCHEMA: Table[] = [
  {
    name: 'department',
    synonyms: ['dept', 'branch', 'faculty', 'school', 'discipline'],
    columns: [
      { name: 'dept_id', type: 'INTEGER', pk: true, synonyms: [] },
      { name: 'dept_name', type: 'TEXT', synonyms: ['department name', 'branch name'] },
      { name: 'building', type: 'TEXT', synonyms: ['block', 'location', 'located'] },
      { name: 'budget', type: 'REAL', synonyms: ['funds', 'funding', 'money', 'allocation'] },
    ],
  },
  {
    name: 'student',
    synonyms: ['pupil', 'learner', 'scholar', 'undergraduate', 'enrolled person'],
    columns: [
      { name: 'student_id', type: 'INTEGER', pk: true, synonyms: ['roll number', 'roll no', 'roll'] },
      { name: 'name', type: 'TEXT', synonyms: ['full name', 'called'] },
      { name: 'dept_id', type: 'INTEGER', fk: 'department.dept_id', synonyms: [] },
      { name: 'year', type: 'INTEGER', synonyms: ['semester', 'batch', 'level'] },
      { name: 'cgpa', type: 'REAL', synonyms: ['gpa', 'grade point', 'score', 'marks', 'topper', 'performance'] },
      { name: 'city', type: 'TEXT', synonyms: ['hometown', 'from', 'native'] },
    ],
  },
  {
    name: 'instructor',
    synonyms: ['professor', 'teacher', 'faculty member', 'lecturer', 'prof', 'mentor'],
    columns: [
      { name: 'instructor_id', type: 'INTEGER', pk: true, synonyms: [] },
      { name: 'name', type: 'TEXT', synonyms: ['full name'] },
      { name: 'dept_id', type: 'INTEGER', fk: 'department.dept_id', synonyms: [] },
      { name: 'salary', type: 'REAL', synonyms: ['pay', 'earning', 'earns', 'income', 'wage'] },
    ],
  },
  {
    name: 'course',
    synonyms: ['subject', 'class', 'paper', 'module', 'elective'],
    columns: [
      { name: 'course_id', type: 'TEXT', pk: true, synonyms: ['course code', 'code'] },
      { name: 'title', type: 'TEXT', synonyms: ['course name', 'subject name'] },
      { name: 'dept_id', type: 'INTEGER', fk: 'department.dept_id', synonyms: [] },
      { name: 'credits', type: 'INTEGER', synonyms: ['credit', 'weightage', 'units'] },
      { name: 'instructor_id', type: 'INTEGER', fk: 'instructor.instructor_id', synonyms: ['taught by'] },
    ],
  },
  {
    name: 'enrollment',
    synonyms: ['registration', 'registered', 'enrolled', 'takes', 'taking', 'opted'],
    columns: [
      { name: 'student_id', type: 'INTEGER', fk: 'student.student_id', synonyms: [] },
      { name: 'course_id', type: 'TEXT', fk: 'course.course_id', synonyms: [] },
      { name: 'grade', type: 'TEXT', synonyms: ['result', 'letter grade', 'got'] },
      { name: 'semester', type: 'TEXT', synonyms: ['term', 'session'] },
    ],
  },
]

const SEED = `
CREATE TABLE department(dept_id INTEGER PRIMARY KEY, dept_name TEXT, building TEXT, budget REAL);
CREATE TABLE student(student_id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER REFERENCES department(dept_id), year INTEGER, cgpa REAL, city TEXT);
CREATE TABLE instructor(instructor_id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER REFERENCES department(dept_id), salary REAL);
CREATE TABLE course(course_id TEXT PRIMARY KEY, title TEXT, dept_id INTEGER REFERENCES department(dept_id), credits INTEGER, instructor_id INTEGER REFERENCES instructor(instructor_id));
CREATE TABLE enrollment(student_id INTEGER REFERENCES student(student_id), course_id TEXT REFERENCES course(course_id), grade TEXT, semester TEXT);
INSERT INTO department VALUES (1,'Computer Science','Turing Block',1850000),(2,'Electronics','Bose Block',1320000),(3,'Mechanical','Visvesvaraya Hall',1100000),(4,'Civil','Kalam Hall',960000),(5,'Mathematics','Ramanujan Block',640000);
INSERT INTO instructor VALUES (1,'Dr. Meera Iyer',1,184000),(2,'Dr. Arjun Rao',1,162000),(3,'Dr. Kavita Menon',2,158000),(4,'Dr. Sanjay Gupta',3,149000),(5,'Dr. Farah Khan',4,141000),(6,'Dr. Vikram Sethi',5,152000),(7,'Dr. Neha Joshi',2,137000);
INSERT INTO course VALUES ('CS301','Database Management Systems',1,4,1),('CS305','Machine Learning',1,4,2),('CS210','Data Structures',1,3,2),('EC220','Digital Electronics',2,3,3),('EC310','Signal Processing',2,4,7),('ME201','Thermodynamics',3,3,4),('CE240','Structural Analysis',4,4,5),('MA101','Linear Algebra',5,3,6),('MA202','Probability and Statistics',5,3,6);
INSERT INTO student VALUES
(101,'Aarav Sharma',1,3,9.1,'Delhi'),(102,'Diya Patel',1,3,8.7,'Ahmedabad'),(103,'Rohan Verma',2,2,7.9,'Lucknow'),(104,'Ananya Reddy',1,4,9.4,'Hyderabad'),(105,'Kabir Singh',3,2,6.8,'Chandigarh'),
(106,'Ishita Nair',5,1,8.2,'Kochi'),(107,'Vihaan Mehta',2,3,8.9,'Mumbai'),(108,'Sara Thomas',4,4,7.4,'Chennai'),(109,'Aditya Kulkarni',1,2,7.2,'Pune'),(110,'Meher Kaur',3,3,8.1,'Amritsar'),
(111,'Arnav Das',2,1,6.9,'Kolkata'),(112,'Tanvi Joshi',5,2,9.0,'Jaipur'),(113,'Yash Agarwal',4,1,7.7,'Kanpur'),(114,'Riya Banerjee',1,1,8.4,'Kolkata'),(115,'Nikhil Pillai',3,4,7.0,'Bengaluru');
INSERT INTO enrollment VALUES
(101,'CS301','A','2026-ODD'),(101,'CS305','A','2026-ODD'),(102,'CS301','B','2026-ODD'),(102,'MA202','A','2026-ODD'),(103,'EC220','B','2026-ODD'),(104,'CS305','A','2026-ODD'),(104,'CS301','A','2025-EVEN'),
(105,'ME201','C','2026-ODD'),(106,'MA101','A','2026-ODD'),(107,'EC310','A','2026-ODD'),(107,'CS210','B','2025-EVEN'),(108,'CE240','B','2026-ODD'),(109,'CS210','C','2026-ODD'),(110,'ME201','B','2026-ODD'),
(111,'EC220','C','2026-ODD'),(112,'MA202','A','2026-ODD'),(112,'CS305','B','2026-ODD'),(113,'CE240','B','2026-ODD'),(114,'CS210','A','2026-ODD'),(114,'MA101','B','2026-ODD'),(115,'ME201','B','2025-EVEN');
`

let dbPromise: Promise<any> | null = null
export function getDb() {
  if (!dbPromise)
    dbPromise = initSqlJs().then((SQL: any) => {
      const db = new SQL.Database()
      db.run(SEED)
      return db
    })
  return dbPromise
}

export type QueryResult = { columns: string[]; rows: unknown[][] }
export async function runSql(sql: string): Promise<QueryResult> {
  const db = await getDb()
  const res = db.exec(sql)
  if (!res.length) return { columns: [], rows: [] }
  return { columns: res[0].columns, rows: res[0].values }
}

/** Distinct text cell values per column, used for value-based linking ("Computer Science" → department.dept_name). */
export async function getCellValues(): Promise<Record<string, string[]>> {
  const db = await getDb()
  const out: Record<string, string[]> = {}
  for (const t of SCHEMA)
    for (const c of t.columns)
      if (c.type === 'TEXT') {
        const r = db.exec(`SELECT DISTINCT ${c.name} FROM ${t.name}`)
        out[`${t.name}.${c.name}`] = r.length ? r[0].values.map((v: unknown[]) => String(v[0])) : []
      }
  return out
}
