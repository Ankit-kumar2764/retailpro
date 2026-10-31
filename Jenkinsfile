pipeline {
  agent any

  stages {
    stage('Install frontend dependencies') {
      steps {
        powershell 'npm ci'
      }
    }
    stage('Install backend dependencies') {
      steps {
        powershell 'npm ci --prefix backend'
      }
    }
    stage('Frontend build') {
      steps {
        powershell 'npm run build'
      }
    }
    stage('Backend syntax checks') {
      steps {
        powershell 'Get-ChildItem backend -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }'
      }
    }
    stage('Backend health smoke test') {
      steps {
        powershell 'npm run backend:health'
      }
    }
  }
}
