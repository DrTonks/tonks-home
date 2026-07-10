import { api } from './index'

export interface Todo {
  id: string
  text: string
  done: boolean
  completed_at: string | null
}

export async function getTodos(): Promise<{ success: boolean; todos: Todo[] }> {
  const res = await api.get('/todos')
  return res.data
}

export async function addTodo(text: string): Promise<{ success: boolean; todo: Todo }> {
  const res = await api.post('/todos', { action: 'add', text })
  return res.data
}

export async function completeTodo(id: string): Promise<{ success: boolean; todo: Todo }> {
  const res = await api.post('/todos', { action: 'complete', id })
  return res.data
}

export async function deleteTodo(id: string): Promise<{ success: boolean }> {
  const res = await api.post('/todos', { action: 'delete', id })
  return res.data
}
