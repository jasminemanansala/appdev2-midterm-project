const http = require('http');
const fs = require('fs');
const { EventEmitter } = require('events');
const path = require('path');

const PORT = 3000;
const todosPath = path.join(__dirname, 'todos.json');
const logPath = path.join(__dirname, 'logs.txt');

// Event emitter for logs.txt
const logger = new EventEmitter();
logger.on('log', (msg) => {
  const time = new Date().toISOString();
  fs.appendFile(logPath, `${time} - ${msg}\n`, (err) => {
    if (err) console.error('Failed to write log:', err);
  });
});

// Read todos
const readTodos = () => {
  const data = fs.readFileSync(todosPath, 'utf8');
  return JSON.parse(data);
};

// Write todos
const writeTodos = (todos) => {
  fs.writeFileSync(todosPath, JSON.stringify(todos, null, 2));
};

// HTTP server
const server = http.createServer((req, res) => {
  const { method, url } = req;
  logger.emit('log', `${method} ${url}`);

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    // GET all todos part
    if (url === '/todos' && method === 'GET') {
      try {
        const todos = readTodos();
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const completed = urlObj.searchParams.get('completed');
        const filtered = completed !== null
          ? todos.filter(todo => String(todo.completed) === completed)
          : todos;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(filtered));
      } catch (err) {
        logger.emit('log', `ERROR on ${method} ${url}: ${err.message}`);
        res.writeHead(500);
        res.end('Internal Server Error: ' + err.message);
      }
    }

    // GET ID part
    else if (url.match(/^\/todos\/\d+$/) && method === 'GET') {
      try {
        const id = parseInt(url.split('/')[2]);
        const todos = readTodos();
        const todo = todos.find(t => t.id === id);

        if (todo) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(todo));
        } else {
          res.writeHead(404);
          res.end('Todo not found');
        }
      } catch (err) {
        logger.emit('log', `ERROR on ${method} ${url}: ${err.message}`);
        res.writeHead(500);
        res.end('Internal Server Error: ' + err.message);
      }
    }

    // POST part
    else if (url.startsWith('/todos') && method === 'POST') {
      try {
        const data = JSON.parse(body);
        if (!data.title) throw new Error('Missing title');

        const todos = readTodos();
        const newTodo = {
          id: todos.length ? Math.max(...todos.map(t => t.id)) + 1 : 1,
          title: data.title,
          completed: data.completed ?? false
        };

        todos.push(newTodo);
        writeTodos(todos);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(newTodo));
      } catch (err) {
        if (err.message === 'Missing title') {
          res.writeHead(400);
          res.end('Bad request: ' + err.message);
        } else {
          logger.emit('log', `ERROR on ${method} ${url}: ${err.message}`);
          res.writeHead(500);
          res.end('Internal Server Error: ' + err.message);
        }
      }
    }

    // PUT part
    else if (url.match(/^\/todos\/\d+$/) && method === 'PUT') {
      try {
        const id = parseInt(url.split('/')[2]);
        const data = JSON.parse(body);
        const todos = readTodos();
        const index = todos.findIndex(t => t.id === id);

        if (index === -1) {
          res.writeHead(404);
          res.end('Todo not found');
        } else {
          todos[index] = { ...todos[index], ...data };
          writeTodos(todos);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(todos[index]));
        }
      } catch (err) {
        logger.emit('log', `ERROR on ${method} ${url}: ${err.message}`);
        res.writeHead(500);
        res.end('Internal Server Error: ' + err.message);
      }
    }

    // DELETE part
    else if (url.match(/^\/todos\/\d+$/) && method === 'DELETE') {
      try {
        const id = parseInt(url.split('/')[2]);
        const todos = readTodos();
        const index = todos.findIndex(t => t.id === id);

        if (index === -1) {
          res.writeHead(404);
          res.end('Todo not found');
        } else {
          const removed = todos.splice(index, 1);
          writeTodos(todos);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(removed[0]));
        }
      } catch (err) {
        logger.emit('log', `ERROR on ${method} ${url}: ${err.message}`);
        res.writeHead(500);
        res.end('Internal Server Error: ' + err.message);
      }
    }

    // Fallback route
    else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
