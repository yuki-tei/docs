# TODO determine how this file is used, and where it ultimately lives

import fileinput
import re
from pathlib import Path

for path in Path('product_docs/docs/pgbouncer').rglob('*.mdx'):
  print(path)


  # edb-postgres-postgis/user-guides/postgis-guide
  # pgbouncer/user-guides/pgbouncer-guide

  # determine legacy url according to "new" scheme
  # this data could live in here, or a metadata file closer to the data
  base_url = 'https://www.enterprisedb.com/edb-docs/d'
  prefix = 'pgbouncer/user-guides/pgbouncer-guide'
  version = '1.0'

  page_file_name = str(path).split('/')[-1].replace('.mdx', '')
  page_file_name = re.sub(r'^\d*_', '', page_file_name)

  legacy_url = '{0}/{1}/{2}/{3}.html'.format(
    base_url,
    prefix,
    version,
    page_file_name
  )

  in_frontmatter = False
  injected_redirect = False
  for line in fileinput.input(files=[str(path)], inplace=1):
    if not injected_redirect and line.startswith('---'):
      if in_frontmatter:
        print('legacyRedirect: "{0}"'.format(legacy_url))
        injected_redirect = True
      in_frontmatter = True

    if not line.startswith('legacyRedirect'):
      print(line, end="")
