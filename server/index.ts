import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import app from './app.js'

const port = Number(process.env.PORT || 3001)
const host = process.env.HOST || '127.0.0.1'
const here = path.dirname(fileURLToPath(import.meta.url))
const staticDirectory = path.resolve(here, '../dist')

app.use(express.static(staticDirectory))
app.use((_request, response) => response.sendFile(path.join(staticDirectory, 'index.html')))
app.listen(port, host, () => console.log(`Memo server listening on http://${host}:${port}`))
