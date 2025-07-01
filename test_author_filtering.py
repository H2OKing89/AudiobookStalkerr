#!/usr/bin/env python3
"""
Test script to verify author filtering logic
"""

# Test the enhanced author filtering
test_author_data = [
    {'name': 'John Smith'},
    {'name': 'Jane Doe - Illustrator'}, 
    {'name': 'Bob Wilson, Translator'},
    {'name': 'Alice Brown - Editor'},
    {'name': 'Charlie Davis (Cover Designer)'},
    {'name': 'Eve Wilson, compiled by'},
    {'name': 'Frank Miller'},
    {'name': 'Mary Johnson - translator'},
    {'name': 'Tom Anderson, edited by Sarah'},
    {'name': 'Lisa Thompson'}
]

# Simulate the filtering logic
authors = []
for author in test_author_data:
    name = author.get('name', '')
    # Skip illustrators, translators, editors, and other non-primary authors
    if name and not any(role in name.lower() for role in [
        '- illustrator', 'illustrator', 
        '- translator', 'translator', 'translated by',
        '- editor', 'editor', 'edited by',
        'foreword', 'afterword',
        'introduction', 'preface',
        'contributor', 'adapter', 'adaptor',
        'compiler', 'compiled by',
        'cover designer', 'cover artist',
        'commentary', 'annotated by',
        'revised by', 'reviser'
    ]):
        authors.append(name)

author_str = ', '.join(authors) if authors else ''
print('=== Author Filtering Test ===')
print(f'Original authors: {[a["name"] for a in test_author_data]}')
print(f'Filtered authors: {authors}')
print(f'Final author string: "{author_str}"')
print('\n=== Expected Result ===')
print('Should keep: John Smith, Frank Miller, Lisa Thompson')
print('Should filter out: Jane Doe - Illustrator, Bob Wilson, Translator, Alice Brown - Editor, Charlie Davis (Cover Designer), Eve Wilson, compiled by, Mary Johnson - translator, Tom Anderson, edited by Sarah')
