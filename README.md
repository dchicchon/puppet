# Summary

tools for wrangling microservices

# Installation

npm i -g @dchicchon/puppet

# Usage

puppet `<command>` [options]

### Commands

puppet command `"<command>"` [filter]

- Send a command to all sub repos. You
  must wrap your command in quotes to
  ensure it's passed in properly
- [aliases: co]

puppet update [filter]

- Update all sub repos to their current branch
- [aliases: up]

puppet branches [filter]

- Get the list of branches for all your sub repos
- [aliases: br]

puppet save `<name>` [filter]

- Save the current branch configuration for all sub repos
- [aliases: sv]

puppet remove `<name>`

- Remove a branch configuration
- [aliases: rm]

puppet run `<name>`

- change to a saved branch configurati
  on
- [aliases: rn]

puppet get [name]

- view all configurations available. If name is specified, the branch configuration will be shown
- [aliases: gt]

Options:

--version Show version number [boolean]

-v, --verbose verbose mode

--help Show help [boolean]

Examples:

```
# Run a specific command in all sub repos
puppet command "git ch main && git pull origin main"
# Run a command in filtered sub repos
puppet command "git ch main && ls" --filter database front-end server
# Save the current sub repo branch configuration to name `default`
puppet save default
# Run the `newFeatureConfig` configuration
puppet run newFeatureConfig
# Remove the `featureIsDone` config from the configs list
puppet remove featureIsDoneConfig
```

# Made with

- ansi-colors
- cli-progress
- table
- yargs

# Miscellaneous info

Site with good info: https://developer.okta.com/blog/2019/06/18/command-line-app-with-nodejs
