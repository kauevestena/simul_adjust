# Free Station

This directory contains an independent project separate from other subfolders in this repository.

## Runtime constraint

This project must stay serverless and user-side only. Accepted changes are limited to static browser assets such as HTML, CSS, and plain JavaScript that run directly in the user's browser. Do not add Node.js, package managers, build steps, backend services, server runtimes, or dependencies that require installation before the page can run.

## index.html

The `index.html` file is a standalone web interface for the free station simulation. It serves as the main entry point for visualizing and interacting with free station adjustment calculations without dependencies on other modules in this test suite.

### Key Features
- Independent implementation
- Self-contained HTML/CSS/JavaScript
- Does not require other subfolder components to run
- Monte Carlo trial runner with seeded Gaussian observation perturbations, global-test acceptance counts, empirical coordinate covariance, bias checks, and a scatter/ellipse visualization

This project can be developed, tested, and deployed independently from sibling directories.
