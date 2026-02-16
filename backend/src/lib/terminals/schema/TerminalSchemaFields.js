const TerminalSchemaFields = {
  name: {
    bsonType: 'string',
    minLength: 1,
  },
  shell: {
    bsonType: 'string',
    enum: ['wsl', 'powershell', 'cmd', 'bash', 'gitbash'],
  },
  command: {
    bsonType: 'string',
  },
  cwd: {
    bsonType: 'string',
  },
};

export default TerminalSchemaFields;
