import { graphql } from "@octokit/graphql";
import 'dotenv/config';

const owner = process.env.OWNER;
const repo = process.env.REPO;
const number = process.env.ISSUE_NUMBER;

await (async function() {
    const github = graphql.defaults({
        headers: {
            authorization: `Bearer ${process.env.GITHUB_TOKEN}`
        }
    });
    
    const {repository} = await github(`
        query {
            repository(owner: "${owner}", name: "${repo}") {
                issue(number: ${number}) {
                    id
                    title
                    body
                }
            }
        }
    `);
    
    const body = repository.issue.body;
    const totalItems = (body.match(/- \[([ x])\]/g) || []).length;
    const completedItems = (body.match(/- \[x\]/g) || []).length;

    // Remove existing progress count if present and add new one
    const title = repository.issue.title.replace(/\s*\[\d+\s*\/\s*\d+\]$/, '') + ` [${completedItems} / ${totalItems}]`;

    await github(`
        mutation {
            updateIssue(input: {
                id: "${repository.issue.id}"
                title: "${title}"
            }) {
                issue {
                    id
                    title
                }
            }
        }
    `);
})();
