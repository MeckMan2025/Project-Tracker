import Papa from 'papaparse'

export const loadTasksFromCSV = async () => {
  try {
    const response = await fetch('/data/tasks.csv')
    const csvText = await response.text()

    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    })

    return result.data.map(task => ({
      ...task,
      skills: task.skills ? task.skills.split(';') : [],
    }))
  } catch (error) {
    console.error('Error loading tasks:', error)
    return []
  }
}

export const tasksToCSV = (tasks) => {
  const data = tasks.map(task => ({
    ...task,
    skills: task.skills ? task.skills.join(';') : '',
  }))

  return Papa.unparse(data)
}

export const downloadCSV = (tasks, filename = 'tasks.csv') => {
  const csv = tasksToCSV(tasks)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
