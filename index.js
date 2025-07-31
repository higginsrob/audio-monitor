#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { parseArgs } = require('util');

const options = {
    port: {
        type: 'string',
        short: 'p',
        description: 'Port to run the server on',
        default: '3000'
    },
    host: {
        type: 'string',
        short: 'h',
        description: 'Host to run the server on',
        default: 'localhost'
    },
    help: {
        type: 'boolean',
        short: 'h',
        description: 'Show this help message'
    },
    browser: {
        type: 'boolean',
        short: 'b',
        description: 'Open the default browser to the server URL'
    }
};

try {
    const { values, positionals } = parseArgs({ options, allowPositionals: true });
    if (values.help) {
        showHelp();
        process.exit(0);
    }
    const port = parseInt(values.port, 10);
    if (isNaN(port) || port <= 0 || port > 65535) {
        throw new Error('Invalid port number. Please provide a valid port between 1 and 65535.');
    }
    const host = values.host;
    if (positionals.length > 0) {
        throw new Error('Unexpected positional arguments: ' + positionals.join(', '));
    }
    run(host, port, values.browser);
} catch (error) {
    console.error(error.message);
    showHelp();
    process.exit(1);
}

function run(host, port, browser = false) {
    const server = http.createServer((req, res) => {
        const filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
        let extname = String(path.extname(filePath)).toLowerCase();
        let contentType = 'text/html';
        switch (extname) {
            case '.js':
                contentType = 'text/javascript';
                break;
            case '.css':
                contentType = 'text/css';
                break;
        }
        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>404 Not Found</h1>', 'utf-8');
                } else {
                    res.writeHead(500);
                    res.end(`Sorry, there was an error: ${ error.code } ..\n`);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    });
    server.listen(port, host, () => {
        console.log(`Audio Monitor Web Server running at http://${host}:${port}/`);
        if (browser) {
            const url = `http://${host}:${port}/`;
            openBrowser(url);
        }
    });
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${port} is already in use. Please choose a different port.`);
        } else {
            console.error(`Audio Monitor Web Server Error: ${err.message}`);
        }
        process.exit(1);
    });
}

function showHelp() {
    console.log(`
Usage: node index.js [options]
Options:
  --port, -p    Port to run the server on (default: 3000)
  --host, -h    Host to run the server on (default: localhost)
  --browser, -b Open the default browser to the server URL
  --help, -h    Show this help message
`);
}

function openBrowser(url) {
    let command;
    switch (process.platform) {
        case 'darwin': // macOS
            command = `open ${url}`;
            break;
        case 'win32': // Windows
            command = `start ${url}`;
            break;
        case 'linux': // Linux
            command = `xdg-open ${url}`;
            break;
        default:
            console.error('Unsupported operating system.');
            return;
    }
    exec(command, (error) => {
        if (error) {
            console.error(`Error opening browser: ${error.message}`);
            return;
        }
        console.log(`Successfully opened ${url} in the default browser.`);
    });
}