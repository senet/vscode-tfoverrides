export interface TerraformVariable {
    name: string;
    type: string | null;
    description: string | null;
    defaultValue: string | null;
    value?: string | null;
}

export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
    try {
        const urlObj = new URL(url);
        if (!urlObj.hostname.includes('github.com')) {
            return null;
        }
        const pathParts = urlObj.pathname.replace(/^\/+/g, '').split('/');
        if (pathParts.length < 2) {
            return null;
        }
        return { owner: pathParts[0], repo: pathParts[1] };
    } catch {
        return null;
    }
}

export function buildRawVariablesUrl(owner: string, repo: string, branch: string): string {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/variables.tf`;
}

export function parseTerraformVariables(content: string): TerraformVariable[] {
    const variableRegex = /variable\s+"([\w-]+)"\s*{([^}]*)}/gs;
    const typeRegex = /type\s*=\s*([^\n]+)/;
    const descriptionRegex = /description\s*=\s*"([^"]*)"/;
    const defaultRegex = /default\s*=\s*("[^"]*"|[^\n]*)/;

    const variables: TerraformVariable[] = [];
    let match: RegExpExecArray | null;
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

export function formatOverrideValue(value: string, variable?: TerraformVariable): string {
    if (!variable?.type) {
        return value;
    }
    const typeLower = variable.type.toLowerCase();
    const isNumber = !isNaN(Number(value));
    const isBoolean = value.toLowerCase() === 'true' || value.toLowerCase() === 'false';

    if (
        typeLower.includes('string') &&
        !typeLower.includes('list(string)') &&
        !typeLower.includes('map(string)')
    ) {
        if (!isNumber && !isBoolean && !(value.startsWith('"') && value.endsWith('"'))) {
            return `"${value}"`;
        }
    }
    return value;
}

export function generateOverrideFileContent(overrides: Map<string, string>, variables: TerraformVariable[]): string {
    let content = '';
    overrides.forEach((value, key) => {
        const variable = variables.find(v => v.name === key);
        const formattedValue = formatOverrideValue(value, variable);
        content += `variable "${key}" {\n  default = ${formattedValue}\n}\n\n`;
    });
    return content;
}
