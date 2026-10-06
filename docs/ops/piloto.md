# Checklist do piloto comercial

O kit técnico não conclui este critério. A Fase 8 só pode ser aceita depois
que uma pessoa registrar que um estabelecimento real operou pedidos reais,
durante o período acordado, sem falha bloqueadora.

## Smoke técnico

Com a API local em execução, o super admin de seed habilitado e as migrations
aplicadas:

```bash
./scripts/smoke-business-day.sh
```

Se as credenciais ou a URL local forem diferentes, informe
`API_BASE_URL`, `PLATFORM_ADMIN_EMAIL` e `PLATFORM_ADMIN_PASSWORD`. O smoke cria
um tenant técnico com nome iniciado por `Smoke`; isso não é evidência de piloto
comercial.

## Registro

- Data de início: ____________________
- Data de término: ____________________
- Nome do estabelecimento: ____________________
- Responsável do estabelecimento: ____________________
- Responsável pela validação: ____________________
- Período acordado: ____________________
- Sem falha bloqueadora: [ ] Sim
- Observações: ____________________

## Evidências a conferir

- [ ] Loja publicada durante o período.
- [ ] Pedidos reais recebidos e concluídos.
- [ ] Dashboard e relatório conferidos.
- [ ] Falhas de WhatsApp analisadas em `/api/v1/platform/pilot-status`.
- [ ] Backup e restore local validados conforme `docs/ops/recuperacao.md`.

Status comercial da Fase 8: **EM ABERTO**.
