const components = {
  MuiLink: {
    defaultProps: {
      underline: 'none',
    },
  },
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        backgroundColor: '#0d1117',
        color: '#e6edf3',
      },
      '::-webkit-scrollbar': {
        width: 8,
        height: 8,
      },
      '::-webkit-scrollbar-track': {
        background: '#161b22',
      },
      '::-webkit-scrollbar-thumb': {
        background: '#30363d',
        borderRadius: 4,
      },
      '::-webkit-scrollbar-thumb:hover': {
        background: '#484f58',
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        backgroundColor: '#161b22',
        backgroundImage: 'none',
        border: '1px solid #30363d',
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        backgroundColor: '#161b22',
        backgroundImage: 'none',
        border: '1px solid #30363d',
        borderRadius: 12,
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          '& fieldset': {
            borderColor: '#30363d',
          },
          '&:hover fieldset': {
            borderColor: '#6e7681',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#58a6ff',
          },
        },
        '& .MuiInputLabel-root': {
          color: '#8b949e',
        },
        '& .MuiInputBase-input': {
          color: '#e6edf3',
        },
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      contained: {
        backgroundColor: '#1f6feb',
        color: '#ffffff',
        boxShadow: 'none',
        '&:hover': {
          backgroundColor: '#388bfd',
          boxShadow: 'none',
        },
      },
      outlined: {
        borderColor: '#30363d',
        color: '#e6edf3',
        '&:hover': {
          borderColor: '#6e7681',
          backgroundColor: 'rgba(110,118,129,0.1)',
        },
      },
      text: {
        color: '#8b949e',
        '&:hover': {
          backgroundColor: 'rgba(110,118,129,0.1)',
        },
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        fontWeight: 500,
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        '&:hover': {
          backgroundColor: 'rgba(110,118,129,0.1)',
        },
        '&.Mui-selected': {
          backgroundColor: 'rgba(31,111,235,0.15)',
          '&:hover': {
            backgroundColor: 'rgba(31,111,235,0.2)',
          },
        },
      },
    },
  },
  MuiDivider: {
    styleOverrides: {
      root: {
        borderColor: '#21262d',
      },
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        color: '#8b949e',
        '&:hover': {
          backgroundColor: 'rgba(110,118,129,0.15)',
          color: '#e6edf3',
        },
      },
    },
  },
};

export default components;
