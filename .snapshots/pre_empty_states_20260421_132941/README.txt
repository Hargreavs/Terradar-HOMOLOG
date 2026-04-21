SNAPSHOT TERRADAR
=================
Data: 21/04/2026 13:29:42
Motivo: pre empty states nas 6 abas + banner condicional + badge diferenciado
Trigger: Session 17, Prompt 2 do chat Claude
Arquivos copiados: 7

Para restaurar qualquer arquivo:
  Copy-Item "C:\Users\alex-\Terrae\.snapshots\pre_empty_states_20260421_132941\<arquivo>" "C:\Users\alex-\Terrae\<caminho_original>"

Para restaurar tudo de uma vez:
  Get-ChildItem "C:\Users\alex-\Terrae\.snapshots\pre_empty_states_20260421_132941" -Filter "src_*" | ForEach-Object {
    $destino = "C:\Users\alex-\Terrae\" + ($_.Name -replace '_', '\')
    Copy-Item $_.FullName $destino -Force
  }