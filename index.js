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
                    body
                    projectsV2 (first: 1) {
                        nodes {
                            id
                            items(first: 1) {
                                nodes {
                                    id
                                }
                            }
                        }
                    }   
                }
            }
        }
    `);
    
    const body = repository.issue.body;
    const totalItems = (body.match(/- \[([ x])\]/g) || []).length;
    const completedItems = (body.match(/- \[x\]/g) || []).length;
    const projectId = repository.issue.projectsV2.nodes[0]?.id;
    const projectItemId = repository.issue.projectsV2.nodes[0]?.items.nodes[0]?.id;
    
    if (!projectId || !projectItemId) {
        return;
    }

    // Get project fields
    const {node: project} = await github(`
        query {
            node(id: "${projectId}") {
                ... on ProjectV2 {
                    fields(first: 20) {
                        nodes {
                            ... on ProjectV2Field {
                                id
                                name
                            }
                            ... on ProjectV2SingleSelectField {
                                id
                                name
                            }
                            ... on ProjectV2IterationField {
                                id
                                name
                            }
                        }
                    }
                }
            }
        }
    `);

    const progressField = project.fields.nodes.find(field => field.name === 'Progress');

    if (!progressField) {
        throw new Error("'Progress' field not found");
    }

    // Update Progress field
    await github(`
        mutation {
            updateProjectV2ItemFieldValue(
                input: {
                    projectId: "${projectId}"
                    itemId: "${projectItemId}"
                    fieldId: "${progressField.id}"
                    value: { 
                        text: "${completedItems}/${totalItems}"
                    }
                }
            ) {
                projectV2Item {
                    id
                }
            }
        }
    `);
})();
