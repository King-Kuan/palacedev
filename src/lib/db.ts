import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, orderBy, where,
  serverTimestamp, Timestamp
} from 'firebase/firestore'
import { db } from './firebase'

// ── TYPES ──────────────────────────────────────────────────────────────────

export interface ProjectFile {
  name: string
  language: string
  content: string
}

export interface Project {
  id?: string
  name: string
  description: string
  notes: string
  runFile: string
  files: ProjectFile[]
  tags: string[]
  pinned: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface Task {
  id?: string
  idea: string
  type: 'generate' | 'fix'
  status: 'pending' | 'running' | 'done' | 'failed'
  projectId?: string
  scheduledAt?: Timestamp | null
  startedAt?: Timestamp | null
  completedAt?: Timestamp | null
  agentMode: boolean
  maxIterations: number
  logs: string[]
  error?: string
  createdAt?: Timestamp
}

// ── PROJECTS ───────────────────────────────────────────────────────────────

export async function saveProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'projects'), {
    ...project,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
  await updateDoc(doc(db, 'projects', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function getProjects(): Promise<Project[]> {
  const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Project))
}

export async function getProject(id: string): Promise<Project | null> {
  const snap = await getDoc(doc(db, 'projects', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Project
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, 'projects', id))
}

export async function togglePin(id: string, pinned: boolean): Promise<void> {
  await updateDoc(doc(db, 'projects', id), { pinned, updatedAt: serverTimestamp() })
}

// ── VERSIONS ───────────────────────────────────────────────────────────────

export async function saveVersion(projectId: string, files: ProjectFile[], label: string): Promise<void> {
  await addDoc(collection(db, 'projects', projectId, 'versions'), {
    files,
    label,
    createdAt: serverTimestamp(),
  })
}

export async function getVersions(projectId: string): Promise<any[]> {
  const q = query(collection(db, 'projects', projectId, 'versions'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── TASKS ──────────────────────────────────────────────────────────────────

export async function createTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'tasks'), {
    ...task,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTask(id: string, data: Partial<Task>): Promise<void> {
  await updateDoc(doc(db, 'tasks', id), data)
}

export async function getTasks(): Promise<Task[]> {
  const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))
}

export async function getPendingScheduledTasks(): Promise<Task[]> {
  const now = Timestamp.now()
  const q = query(
    collection(db, 'tasks'),
    where('status', '==', 'pending'),
    where('scheduledAt', '<=', now)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))
}

export async function getQueuedTasks(): Promise<Task[]> {
  const q = query(
    collection(db, 'tasks'),
    where('status', '==', 'pending'),
    where('scheduledAt', '==', null),
    orderBy('createdAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))
}
