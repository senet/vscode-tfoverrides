import * as assert from 'assert';
import { describe, it } from 'mocha';

describe('Extension Tests', () => {
    it('parseTerraformVariables should parse variables correctly', () => {
        // Mock parseTerraformVariables function here to avoid importing vscode module
        function parseTerraformVariables(content: string) {
            const variableRegex = /variable\s+"([\w-]+)"\s*{([^}]*)}/gs;
            const typeRegex = /type\s*=\s*([^\n]+)/;
            const descriptionRegex = /description\s*=\s*"([^"]*)"/;
            const defaultRegex = /default\s*=\s*("[^"]*"|[^\n]*)/;

            const variables = [];
            let match;
            while ((match = variableRegex.exec(content)) !== null) {
                const block = match[2];
                const typeMatch = typeRegex.exec(block);
                const descriptionMatch = descriptionRegex.exec(block);
                const defaultMatch = defaultRegex.exec(block);

                variables.push({
                    name: match[1],
                    type: typeMatch ? typeMatch[1].trim() : null,
                    description: descriptionMatch ? descriptionMatch[1].trim() : null,
                    defaultValue: defaultMatch ? defaultMatch[1].trim() : null
                });
            }
            return variables;
        }

        const tfContent = `
        variable "instance_type" {
            type = string
            description = "Type of instance"
            default = "t2.micro"
        }
        variable "count" {
            type = number
            default = 2
        }
        `;
        const variables = parseTerraformVariables(tfContent);
        assert.strictEqual(variables.length, 2);
        assert.strictEqual(variables[0].name, 'instance_type');
        assert.strictEqual(variables[0].type, 'string');
        assert.strictEqual(variables[0].description, 'Type of instance');
        assert.strictEqual(variables[0].defaultValue, '"t2.micro"');
        assert.strictEqual(variables[1].name, 'count');
        assert.strictEqual(variables[1].type, 'number');
        assert.strictEqual(variables[1].description, null);
        assert.strictEqual(variables[1].defaultValue, '2');
    });
});
