import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import {config} from 'dotenv';
import {homedir} from 'os';

config()

const pythonPath = '/home/mat/traitementUrlObsidian.py'; // remplacer par le chemin du programme Python
const markdownDir = homedir() + process.env.STORAGE_PATH.split("~")[1]; // remplacer par le chemin du dossier où enregistrer les fichiers Markdown

async function handleRequests(req, res) {
    if (req.method === 'POST') {
        console.log(req.body);
        const { url, folder, title, tags, type, up } = req.body;
        if (!url || !folder) {
            res.writeHead(400, {'Content-Type': 'text/plain'});
            res.end('URL and folder are required');
            return;
        }

        const markdownFile = path.join(markdownDir, folder, `${title}.md`);
        const markdownDirPath = path.join(markdownDir, folder);

        try {
            if (!fs.existsSync(markdownDirPath)) {
                fs.mkdirSync(markdownDirPath);
            }

            const arg = `{url:${url},type:${type},up:${up},tags:${tags.join("*")}}`;

            console.log(arg);

            const pythonProcess = spawn('/usr/bin/python3', [pythonPath, arg]);

            let markdownContent = '';

            pythonProcess.stdout.on('data', (data) => {
                markdownContent += data.toString();
            });

            pythonProcess.on('error', (error) => {
                console.error('Erreur Python :', error);
                res.writeHead(500, {'Content-Type': 'text/plain'});
                res.end('Internal Server Error');
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('Erreur Python : le processus a échoué avec le code', code);
		    res.statusCode = 500;
		    res.end("Pb Python");
		    return;
                }

                fs.writeFileSync(markdownFile, markdownContent);

                console.log(process.env.KEY_PATH)

                exec(`cd ${markdownDir} && /usr/bin/git add ${markdownFile} && /usr/bin/git commit -m "Added ${title}.md"`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`exec error: ${error}`);
                        return;
                    }
                    console.log("Commit créé");
                    exec(`eval $(ssh-agent -s) && ssh-add ${process.env.KEY_PATH} && cd ${markdownDir} && /usr/bin/git push origin main`, { env: process.env }, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`exec error: ${error}`);
                            return;
                        }
                        console.log("Push fait !");
                        res.write(`Markdown file created for ${title} in folder ${folder}`);
                        res.end();
                    });
                });

            });
        } catch (error) {
            console.error('Erreur :', error);
            res.writeHead(500, {'Content-Type': 'text/plain'});
            res.end('Internal Server Error');
        }
    } else {
        res.writeHead(405, {'Content-Type': 'text/plain'});
        res.end('Method not allowed');
    }
}

function parseJsonBody(req, res, next) {
    let body = '';
    req.on('data', chunk => {
        body += chunk;
    });
    req.on('end', () => {
        try {
            req.body = JSON.parse(body);
        } catch (error) {
        }
        next();
    });
}

const server = http.createServer(async (req, res) => {
    parseJsonBody(req, res, async () => {
        await handleRequests(req, res);
    });
});

server.listen(22000);
