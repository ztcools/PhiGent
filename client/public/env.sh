#!/bin/bash

# Recreate config file
rm -rf ./dist/env-config.js
touch ./dist/env-config.js

# Add assignment
echo "window._env_ = {" >> ./dist/env-config.js

# Read each line in .env file
# Each line represents key=value pairs
while read -r line || [[ -n "$line" ]];
do
  # Skip blanks and comments. A comment may itself contain `=` ("# empty = default"),
  # and emitting it verbatim makes env-config.js a JS syntax error, which takes the
  # whole console down with an undefined window._env_.
  [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
  [[ "$line" != *=* ]] && continue

  # Split env variables by character `=`
  varname=${line%%=*}
  varvalue=${line#*=}
  # Only real identifiers become object keys.
  [[ "$varname" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

  # Read value of current variable if exists as Environment variable
  value=$(printf '%s\n' "${!varname}")
  # Otherwise use value from .env file
  [[ -z $value ]] && value=${varvalue}

  # Append configuration property to JS file
  echo "  $varname: \"$value\"," >> ./dist/env-config.js
done < ./dist/.env

echo "}" >> ./dist/env-config.js