import * as assert from 'assert';
import { describe, it } from 'mocha';
import { parseTerraformVariables, formatOverrideValue, generateOverrideFileContent, parseGitHubRepoUrl, TerraformVariable } from '../src/shared';

describe('parseTerraformVariables', () => {
    it('parses variables with all fields', () => {
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

    it('parses variable with no optional fields', () => {
        const variables = parseTerraformVariables(`variable "simple" {}`);
        assert.strictEqual(variables.length, 1);
        assert.strictEqual(variables[0].name, 'simple');
        assert.strictEqual(variables[0].type, null);
        assert.strictEqual(variables[0].description, null);
        assert.strictEqual(variables[0].defaultValue, null);
    });

    it('parses hyphenated variable names', () => {
        const variables = parseTerraformVariables(`variable "my-var-name" { type = string }`);
        assert.strictEqual(variables.length, 1);
        assert.strictEqual(variables[0].name, 'my-var-name');
    });

    it('returns empty array for empty content', () => {
        assert.deepStrictEqual(parseTerraformVariables(''), []);
    });

    it('returns empty array when no variable blocks present', () => {
        assert.deepStrictEqual(parseTerraformVariables('resource "aws_instance" "this" {}'), []);
    });
});

describe('formatOverrideValue', () => {
    it('quotes string type values', () => {
        const v: TerraformVariable = { name: 'x', type: 'string', description: null, defaultValue: null };
        assert.strictEqual(formatOverrideValue('hello', v), '"hello"');
    });

    it('does not double-quote already-quoted values', () => {
        const v: TerraformVariable = { name: 'x', type: 'string', description: null, defaultValue: null };
        assert.strictEqual(formatOverrideValue('"hello"', v), '"hello"');
    });

    it('does not quote boolean values for string type', () => {
        const v: TerraformVariable = { name: 'x', type: 'string', description: null, defaultValue: null };
        assert.strictEqual(formatOverrideValue('true', v), 'true');
        assert.strictEqual(formatOverrideValue('false', v), 'false');
    });

    it('does not quote numeric values for string type', () => {
        const v: TerraformVariable = { name: 'x', type: 'string', description: null, defaultValue: null };
        assert.strictEqual(formatOverrideValue('42', v), '42');
    });

    it('does not quote list(string) values', () => {
        const v: TerraformVariable = { name: 'x', type: 'list(string)', description: null, defaultValue: null };
        assert.strictEqual(formatOverrideValue('["a","b"]', v), '["a","b"]');
    });

    it('does not quote map(string) values', () => {
        const v: TerraformVariable = { name: 'x', type: 'map(string)', description: null, defaultValue: null };
        assert.strictEqual(formatOverrideValue('{k="v"}', v), '{k="v"}');
    });

    it('does not quote number type values', () => {
        const v: TerraformVariable = { name: 'x', type: 'number', description: null, defaultValue: null };
        assert.strictEqual(formatOverrideValue('42', v), '42');
    });

    it('returns value unchanged when no variable provided', () => {
        assert.strictEqual(formatOverrideValue('hello'), 'hello');
    });

    it('returns value unchanged when variable has no type', () => {
        const v: TerraformVariable = { name: 'x', type: null, description: null, defaultValue: null };
        assert.strictEqual(formatOverrideValue('hello', v), 'hello');
    });
});

describe('generateOverrideFileContent', () => {
    it('generates HCL variable blocks with correct formatting', () => {
        const variables: TerraformVariable[] = [
            { name: 'region', type: 'string', description: null, defaultValue: null },
            { name: 'count', type: 'number', description: null, defaultValue: null }
        ];
        const overrides = new Map([['region', 'us-east-1'], ['count', '3']]);
        const result = generateOverrideFileContent(overrides, variables);
        assert.ok(result.includes('variable "region" {\n  default = "us-east-1"\n}'));
        assert.ok(result.includes('variable "count" {\n  default = 3\n}'));
    });

    it('returns empty string for empty overrides', () => {
        assert.strictEqual(generateOverrideFileContent(new Map(), []), '');
    });
});

describe('parseGitHubRepoUrl', () => {
    it('parses a standard GitHub repo URL', () => {
        const result = parseGitHubRepoUrl('https://github.com/owner/repo');
        assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    it('parses a URL with trailing path segments', () => {
        const result = parseGitHubRepoUrl('https://github.com/terraform-aws-modules/terraform-aws-ec2-instance');
        assert.deepStrictEqual(result, { owner: 'terraform-aws-modules', repo: 'terraform-aws-ec2-instance' });
    });

    it('returns null for non-GitHub URLs', () => {
        assert.strictEqual(parseGitHubRepoUrl('https://gitlab.com/owner/repo'), null);
    });

    it('returns null for malformed URLs', () => {
        assert.strictEqual(parseGitHubRepoUrl('not-a-url'), null);
    });

    it('returns null for GitHub URL missing repo', () => {
        assert.strictEqual(parseGitHubRepoUrl('https://github.com/owner'), null);
    });
});
