# WebEstoque Demo

Projeto estático para demonstração visual do VStock sem backend.

## Como usar
- Hospede esta pasta em qualquer servidor estático.
- Abra `login.html`.
- Credenciais demo:
  - Admin: `admin@admin.login` / `123456`
  - Alias admin: `admin@admin` / `123456`
  - Operador: `funcionario04@demoestoque.com` / `123456`

## Dados mockados
- 20 categorias
- 20 fornecedores
- 20 funcionários
- 20 produtos
- 20 entradas
- 20 saídas
- histórico, estoque e alertas derivados desses dados

## Reset dos dados locais
No console do navegador:

```js
VStockDemo.reset()
```

