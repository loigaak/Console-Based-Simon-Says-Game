#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');
const npmFetch = require('npm-registry-fetch');
const glob = require('glob');

// Report file path
const REPORT_FILE = path.join(process.cwd(), 'dep-check-report.json');

// Read package.json
async function readPackageJson() {
  try {
    const data = await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8');
    return JSON.parse(data);
  } catch {
    throw new Error('Could not read package.json. Ensure you are in a Node.js project directory.');
  }
}

// Check for outdated packages
async function checkOutdated() {
  const pkg = await readPackageJson();
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  const outdated = [];

  for (const [name, version] of Object.entries(dependencies)) {
    try {
      const info = await npmFetch.json(`/${name}`);
      const latest = info['dist-tags'].latest;
      if (version !== latest && !version.includes(latest)) {
        outdated.push({ name, installed: version, latest });
      }
    } catch {
      console.log(chalk.yellow(`Could not fetch info for ${name}.`));
    }
  }
  return outdated;
}

// Basic check for unused dependencies (heuristic: check imports in .js files)
async function checkUnused() {
  const pkg = await readPackageJson();
  const dependencies = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  const unused = [];

  const files = glob.sync('**/*.js', { cwd: process.cwd(), ignore: ['node_modules/**'] });
  const fileContents = await Promise.all(
    files.map(file => fs.readFile(path.join(process.cwd(), file), 'utf8'))
  );

  for (const dep of dependencies) {
    const isUsed = fileContents.some(content =>
      content.includes(`require('${dep}')`) || content.includes(`import.*${dep}`)
    );
    if (!isUsed) {
      unused.push(dep);
    }
  }
  return unused;
}

// Mock vulnerability check (simplified; real-world would use an API like npm audit)
async function checkVulnerabilities() {
  const pkg = await readPackageJson();
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  const vulnerabilities = [];

  // Mock data for demo (replace with real API call in production)
  const mockVulns = {
    'lodash': ['<4.17.21', 'Potential prototype pollution'],
    'express': ['<4.18.0', 'CVE-2023-1234']
  };

  for (const [name, version] of Object.entries(dependencies)) {
    if (mockVulns[name] && version.includes(mockVulns[name][0].replace('<', ''))) {
      vulnerabilities.push({ name, version, issue: mockVulns[name][1] });
    }
  }
  return vulnerabilities;
}

// Generate and save report
async function saveReport() {
  const report = {
    timestamp: new Date().toISOString(),
    outdated: await checkOutdated(),
    unused: await checkUnused(),
    vulnerabilities: await checkVulnerabilities(),
  };
  await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(chalk.green(`Report saved to ${REPORT_FILE}`));
  return report;
}

// Display scan results
async function scanProject() {
  console.log(chalk.blue('Scanning project dependencies...'));

  // Check outdated
  const outdated = await checkOutdated();
  console.log(chalk.cyan('\nOutdated Packages:'));
  if (outdated.length) {
    outdated.forEach(pkg => {
      console.log(chalk.yellow(`${pkg.name}: ${pkg.installed} -> ${pkg.latest}`));
    });
  } else {
    console.log(chalk.green('All packages are up to date!'));
  }

  // Check unused
  const unused = await checkUnused();
  console.log(chalk.cyan('\nPotentially Unused Packages:'));
  if (unused.length) {
    unused.forEach(dep => console.log(chalk.yellow(dep)));
    console.log(chalk.gray('Note: This is a heuristic check. Verify manually.'));
  } else {
    console.log(chalk.green('No unused packages detected!'));
  }

  // Check vulnerabilities
  const vulnerabilities = await checkVulnerabilities();
  console.log(chalk.cyan('\nPotential Vulnerabilities:'));
  if (vulnerabilities.length) {
    vulnerabilities.forEach(vuln => {
      console.log(chalk.red(`${vuln.name} (${vuln.version}): ${vuln.issue}`));
    });
  } else {
    console.log(chalk.green('No known vulnerabilities detected!'));
  }
}

program
  .command('scan')
  .description('Scan project dependencies for issues')
  .action(async () => {
    try {
      await scanProject();
    } catch (error) {
      console.log(chalk.red(error.message));
    }
  });

program
  .command('outdated')
  .description('List outdated packages')
  .action(async () => {
    try {
      const outdated = await checkOutdated();
      if (outdated.length) {
        outdated.forEach(pkg => {
          console.log(chalk.yellow(`${pkg.name}: ${pkg.installed} -> ${pkg.latest}`));
        });
      } else {
        console.log(chalk.green('All packages are up to date!'));
      }
    } catch (error) {
      console.log(chalk.red(error.message));
    }
  });

program
  .command('unused')
  .description('List potentially unused packages')
  .action(async () => {
    try {
      const unused = await checkUnused();
      if (unused.length) {
        unused.forEach(dep => console.log(chalk.yellow(dep)));
        console.log(chalk.gray('Note: This is a heuristic check. Verify manually.'));
      } else {
        console.log(chalk.green('No unused packages detected!'));
      }
    } catch (error) {
      console.log(chalk.red(error.message));
    }
  });

program
  .command('report')
  .description('Generate and save a dependency report')
  .action(async () => {
    try {
      const report = await saveReport();
      console.log(chalk.blue('Report Summary:'));
      console.log(chalk.cyan(`Outdated: ${report.outdated.length} packages`));
      console.log(chalk.cyan(`Potentially Unused: ${report.unused.length} packages`));
      console.log(chalk.cyan(`Vulnerabilities: ${report.vulnerabilities.length} issues`));
    } catch (error) {
      console.log(chalk.red(error.message));
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log(chalk.cyan('Use the "scan" command to analyze your project dependencies!'));
}
