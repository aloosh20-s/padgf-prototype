$word = New-Object -ComObject Word.Application
$word.Visible = $false
$docPath = 'E:\BlockShain\our progect in blockshain\sandwitch\New folder\PreSend_Adaptive_Decision_Guard_Framework_2.docx'
$doc = $word.Documents.Open($docPath)
$selection = $word.Selection

# Update 1: Justification
$selection.HomeKey(6) | Out-Null
$selection.Find.Text = 'observed market conditions.'
if ($selection.Find.Execute()) {
    $selection.Collapse(0)
    $selection.TypeText(' Furthermore, robust validation of these heuristics would require a formal sensitivity analysis across varying risk weights, as well as historical backtesting against known sandwich attacks on the Ethereum mainnet to empirically define the optimal boundary between false positives and false negatives.')
    Write-Host 'Updated Justification.'
} else {
    Write-Host 'Could not find Justification text.'
}

# Update 2: Limitations
$selection.HomeKey(6) | Out-Null
$selection.Find.Text = 'The second limitation is the absence of live mempool'
if ($selection.Find.Execute()) {
    $selection.Collapse(1)
    $selection.TypeText("A closely related limitation is the challenge of real-time state synchronization latency. In live Ethereum, the mempool state fluctuates in milliseconds. By the time PADGF simulates a transaction locally, evaluates the risk score, and the user approves the execution, the blockchain state may have already drifted. This delay risks rendering the simulated reference output outdated before the transaction is even broadcast, posing a significant hurdle for client-side evaluation accuracy. ")
    $selection.TypeParagraph()
    Write-Host 'Updated Limitations.'
} else {
    Write-Host 'Could not find Limitations text.'
}

$doc.Save()
$doc.Close()
$word.Quit()
