# **Specify - Sepec Driven Development (SDD)**

## GitHub Spec-Kit

[url -> github/spec-kit](https://github.com/github/spec-kit)

### Get Started

1. Install Specify CLI
   Requires uv (install uv).

- Install uv
  Windows — Standalone Installer

  ```bash
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  ```

- Install specify: Replace vX.Y.Z with the latest release tag from Releases — keep the leading v (for example, v0.12.11, not 0.12.11):

  ```bash
  uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z
  ```

- Se instala última versión del repo.

  ```bash
  uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@v0.16.2
  ```

- `specify` permite validar en cli que esta instalado, con el comando `specify --help` muestra la ayuda en la cli sobre los comandos de la librería.

---

### Iniciar un proyecto

- Iniciar con codex

  ```bash
  specify init proyecto1 --integration codex
  ```

  - Revisar las skill

  ```bash
  $speck
  ```

- Inciar con claude

  ```bash
  specify init proyecto2 --integration claude
  ```

  - Revisar las skill

  ```bash
  /speck
  ```

- **Seguridad:** considerar agregar `.agents/` al `.gitignore`

---

### Constitución del proyecto

- Iniciar constitución con speckit con agente claude

```
/speckit-constitution
```
