## Contribution guidelines

### Local setup

- Clone the repo
- Install the dependencies - `npm install`
- Ensure to have the platform running either locally or somewhere else.
- Go into package.json and press `F5` and click on debug anyway.
- In the newly opened window, change the URLs for the extension if the platform is not prod for your testing.
- Click on the icon on the sidebar, and login.

### Building for the marketplace

- Install the builder vsce - `npm install -g vsce`
- Package the application using - `vsce package`
- Publish using - `vsce publish` (I haven't tested this step yet).
