# encoding: utf-8

# prices -- script for converting csv data into (compact) json


import re, json
from collections import OrderedDict


class mapping(OrderedDict):
	"""mapping: an OrderedDict type used to preserve key ordering -- NOTE: no attribute set syntax"""

	def __getattr__(self, name):
		if name in self: return self[name]
		raise AttributeError


# pieces to use in line patterns
# city names: \w may not contain some accented characters, in this case, simpler to just add them
# numbers: sometimes preceeded (or replaced) with '-', containing ',' or '.', or represented as 'n.a.'
# car names: multi-word, contain alphanum and some punctuation, enclosed in ''
pieces = {
	'city': r"(?P<city>[\wáã ]+?\S)",
	'number': r"(?: +(?:-|-?[0-9na.,]+))",
	'car': r"'(?P<car>[\w., ]+)'",
	'currency': r"(?:[A-Z]+ [0-9]+)",
	'country': r"\(([\w., ]+)\)",
}

# block and line patterns (cityname + numbers), and some blocks which have a different format
patterns = {
	'block': r"^\n(?P<header>.+)\n(?P<fields>.+)\n(?P<lines>(?:.+\n)+?)^\n",
	'line': r"{city}({number}+)\n",
	'Exchange rates and changes': r"{city} +({currency})({number}+)\n",
	'Exchange rate changes': r"{city} +{currency}{number}({number}){number}({number})\n",
	'Car prices and maintenance costs': r"{city} +{car}({number}{{3}})\n",
	'Inflation 2009-2012': r"{city} +{country}({number}+)\n",
}

# insert pieces into these patterns
patterns = dict((k, v.format(**pieces)) for k, v in patterns.items())


def to_float(a):
	"""Convert a text number or '-' or 'n.a.' into float"""
	try: return float(a)
	except: return 0 if a == 'n.a.' or a == '-' else a

def parse_block(block):
	"""Parses a text block of block name, field list, and lines of values; returns an ordered dict"""

	parse_name = lambda x: x.split(',') if ',' in x else [x.split(': ')[1].replace(' ', '_'), x]
	parse_fields = lambda fields: map(lambda x: x.split(',') if ',' in x else [x.lower(), x.replace('_', ' ')], fields.split(';'))
	parse_line = lambda x: [x[0]] + (x[1].split() if len(x) == 2 else [x[1].strip()] + x[2].split())
	parse_lines = lambda lines, pattern: map(parse_line, re.findall(pattern, lines))

	name = parse_name(block[0])
	fields = parse_fields(block[1])
	lines = parse_lines(block[2], patterns.get(name[1], patterns['line']))

	return mapping([['name', name], ['fields', mapping(fields)], ['lines', lines]])

def compose_json(blocks):
	"""Formats text blocks into json, returning a list of cities, professions, and wages"""

	cities = mapping(map(lambda line: [line[0], mapping([('name', line[0])])], blocks[3].lines))
	professions = []
	wages = []
	is_income = lambda x: x.name[1].startswith('Income:')

	def add_block(block):
		# fields of this block: blockname_fieldname (excluding the first 'City' field)
		fields = map(lambda x: block.name[0] + '_' + x, block.fields.keys()[1:])
		# add fields + values in lines to the city (line[0])
		for line in block.lines:
			cities[line[0]].update(zip(fields, map(to_float, line[1:])))

	def add_income(block):
		professions.append(mapping([('name', block.name[1].split(': ')[1].capitalize())]))
		fields = ['profession', 'city'] + map(lambda x: x, block.fields.keys()[1:])
		for line in block.lines:
			wages.append(mapping(zip(fields, [block.name[0]] + map(to_float, line))))

	[add_income(block) if is_income(block) else add_block(block) for block in blocks]

	cities = cities.values()
	return cities, professions, wages

def compact_json(blocks):
	"""Formats text blocks into compact json, returning a list of cities, professions, and wages"""

	cities = mapping([('fields', [])] + map(lambda line: [line[0], [line[0]]], blocks[3].lines))
	professions = []
	wages = [['gross', 'net', 'hours']]
	wages = [blocks[-1].fields.items()[1:]]
	is_income = lambda x: x.name[1].startswith('Income:')

	def add_block(block):
		cities['fields'] += map(lambda x: '%s.%s.%s' % (block.name[0], x[0], x[1]), block.fields.items()[1:])
		for line in block.lines: cities[line[0]] += map(to_float, line[1:])

	def add_income(block):
		professions.append(block.name[0])
		[wages.append(map(to_float, line[1:])) for line in block.lines]

	[add_income(block) if is_income(block) else add_block(block) for block in blocks]
	blocks = [block.name for block in blocks if not is_income(block)]
	blocks.pop(-2) # exchange rate changes, which is merged with the exchange rates block

	cities['fields'] = list(mapping.fromkeys(cities.fields)) # filter out duplicate fields

	return [blocks, cities.values(), professions, wages]

def process_data(filename, compact=1):
	with open(filename, 'rU') as f: content = f.read()

	blocks = re.findall(patterns['block'], content, re.MULTILINE | re.UNICODE)
	blocks = map(parse_block, blocks)
	blocknames, cities, professions, wages = (compact_json if 1 or compact else compose_json)(blocks)

	def list_fields():
		fields = map(lambda block: "\n".join(map(lambda field: '%s_%s' % (block.name[0], field), block.fields.keys()[1:])), blocks)
		print "\n".join(fields)

	b = mapping((('profession', professions), ('charts', blocknames), ('city', cities), ('wage', wages)))
	content = json.dumps(b, indent=None if compact else 2)
	if compact: content = content.replace(', ', ',').replace('.0,', ',').replace('.0]', ']')

	prefix = 'prices_data = '

	filename = filename.rsplit('.', 1)[0] + '.' + ['.json', '.compact.json'][compact]
	with open(filename, 'w') as f: f.write(prefix + content)


# build a human-readable json format, then a compact one
process_data('rsc/prices_and_earnings_2012.csv', 0)
process_data('rsc/prices_and_earnings_2012.csv')
