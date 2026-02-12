import {
  createCard,
  createColumn,
  getSettings,
  getState,
  removeCard,
  removeColumn,
  reorderColumnCards,
  reorderColumns,
  resetBackground,
  saveSettings,
  updateCard,
  updateColumn,
  uploadBackground,
} from './js/api.js'
import { createElement } from './js/dom-utils.js'
import { DEFAULT_SETTINGS, applySettingsToDom, mergeSettings } from './js/settings-store.js'
import { askConfirm, notifyError, notifySuccess } from './js/ui-feedback.js'

let settings = { ...DEFAULT_SETTINGS }
async function loadSettings(){
  try{
    const incoming = await getSettings()
    if(incoming){
      settings = mergeSettings(settings, incoming)
      applySettings()
    }
  }catch(e){
    console.warn('Failed loading settings', e)
  }
}
function applySettings(){
  applySettingsToDom(settings)
}

async function fetchState(){
  return getState()
}

let dragState = { type: null, columnId: null, cardId: null }

function render(board){
  const main = document.getElementById('board'); main.innerHTML='';
  // ensure board-level drag handlers for easier drops
  if(!main._dndInitialized){
    main._placeholder = null
    main.addEventListener('dragover', boardDragOver)
    main.addEventListener('dragleave', boardDragLeave)
    main.addEventListener('drop', boardDrop)
    main._dndInitialized = true
  }
  board.columns.forEach(col => {
    const c = createElement('div','column')
    c.dataset.id = col.id
    const colTitle = createElement('div','col-title', col.name)
    colTitle.draggable = true
    c.appendChild(colTitle)
    // column drag handlers
    colTitle.addEventListener('dragstart', (ev)=>{
      dragState = { type: 'column', columnId: String(col.id), cardId: null }
      ev.dataTransfer.setData('text/plain', 'column:'+col.id)
      ev.dataTransfer.effectAllowed = 'move'
    })
    colTitle.addEventListener('dragend', ()=>{
      dragState = { type: null, columnId: null, cardId: null }
      clearPlaceholder()
      document.querySelectorAll('.column').forEach(x=>x.classList.remove('drop-target'))
    })
    col.cards.forEach(card => {
      const cd = createElement('div','card')
      cd.dataset.id = card.id
      cd.draggable = true
      cd.style.cursor = 'grab'
      // card dragstart
      cd.addEventListener('dragstart', (ev)=>{
        ev.stopPropagation()
        dragState = { type: 'card', columnId: String(col.id), cardId: String(card.id) }
        ev.dataTransfer.setData('text/plain', 'card:'+card.id+':'+col.id)
        ev.dataTransfer.effectAllowed = 'move'
      })
      cd.addEventListener('dragend', ()=>{
        dragState = { type: null, columnId: null, cardId: null }
      })
      // card dragover/drop: only accept cards from same column
      cd.addEventListener('dragover', (ev)=>{ 
        if(dragState.type !== 'card') return
        if(dragState.columnId !== String(col.id)) return
        ev.preventDefault()
        ev.dataTransfer.dropEffect = 'move'
      })
      cd.addEventListener('drop', async (ev)=>{
        ev.stopPropagation()
        ev.preventDefault()
        if(dragState.type !== 'card') return
        if(dragState.columnId !== String(col.id)) return
        const draggedCardId = dragState.cardId
        
        const draggedEl = document.querySelector('.card[data-id="'+draggedCardId+'"]')
        if(!draggedEl) return
        
        const rect = cd.getBoundingClientRect()
        const pos = (ev.clientY - rect.top) < rect.height/2 ? 'before' : 'after'
        if(pos === 'after'){
          cd.parentNode.insertBefore(draggedEl, cd.nextSibling)
        } else {
          cd.parentNode.insertBefore(draggedEl, cd)
        }
        
        // reorder cards in column
        const order = Array.from(c.querySelectorAll('.card')).map(x=>x.dataset.id)
        await reorderColumnCards(col.id, order)
      })
      const title = createElement('div','title')
      if(card.icon){ const img = document.createElement('img'); img.src = card.icon; img.style.height='18px'; img.style.marginRight='6px'; title.appendChild(img) }
      if(card.link){ const a = document.createElement('a'); a.href=card.link; a.textContent=card.title; a.target='_blank'; title.appendChild(a)} else { title.appendChild(document.createTextNode(card.title)) }
      cd.appendChild(title)
      if(card.description) { const d = createElement('div','desc', card.description); cd.appendChild(d) }
      const menu = document.createElement('button'); menu.className = 'card-menu'; menu.textContent = '⋯'
      menu.addEventListener('click', (ev)=>{ ev.stopPropagation(); openModalForCard(card) })
      cd.appendChild(menu)
      // double-click also opens edit
      cd.addEventListener('dblclick', ()=> openModalForCard(card))
      c.appendChild(cd)
    })
    // allow dropping cards into empty area of column (same column only)
    c.addEventListener('dragover', (ev)=>{ 
      if(dragState.type !== 'card') return
      if(dragState.columnId !== String(col.id)) return
      ev.preventDefault()
      ev.dataTransfer.dropEffect = 'move'
    })
    c.addEventListener('drop', async (ev)=>{
      if(dragState.type !== 'card') return
      if(dragState.columnId !== String(col.id)) return
      const draggedCardId = dragState.cardId
      ev.preventDefault()
      const draggedEl = document.querySelector('.card[data-id="'+draggedCardId+'"]')
      if(!draggedEl) return
      
      c.appendChild(draggedEl)
      const order = Array.from(c.querySelectorAll('.card')).map(x=>x.dataset.id)
      await reorderColumnCards(col.id, order)
    })

    main.appendChild(c)
  })
}

function createPlaceholder(){
  const ph = document.createElement('div')
  ph.className = 'drop-placeholder'
  return ph
}

function boardDragOver(ev){
  // only handle column drops at board level; card drops handled per-column
  if(dragState.type !== 'column') return
  
  ev.preventDefault()
  const main = ev.currentTarget
  // auto-scroll if near edges
  const margin = 60
  if(ev.clientY < margin) window.scrollBy(0, -20)
  else if(window.innerHeight - ev.clientY < margin) window.scrollBy(0, 20)

  // find closest column by X
  const cols = Array.from(document.querySelectorAll('.column'))
  if(cols.length === 0) return
  let closest = null; let minDist = Infinity
  cols.forEach(c => {
    const r = c.getBoundingClientRect()
    const cx = r.left + r.width/2
    const dx = Math.abs(ev.clientX - cx)
    if(dx < minDist){ minDist = dx; closest = c }
  })
  if(!closest) return
  // show outline
  document.querySelectorAll('.column').forEach(c=>c.classList.remove('drop-target'))
  closest.classList.add('drop-target')

  // for columns, show before/after depending on horizontal position
  clearPlaceholder()
  const ph = createPlaceholder()
  const rect = closest.getBoundingClientRect()
  if((ev.clientX - rect.left) < rect.width/2){ closest.parentNode.insertBefore(ph, closest) }
  else { closest.parentNode.insertBefore(ph, closest.nextSibling) }
  main._placeholder = ph
}

function boardDragLeave(ev){
  if(ev.currentTarget.contains(ev.relatedTarget)) return
  // clear visuals when leaving board
  clearPlaceholder()
  document.querySelectorAll('.column').forEach(c=>c.classList.remove('drop-target'))
}

async function boardDrop(ev){
  // only handle column drops at board level
  if(dragState.type !== 'column') return
  
  ev.preventDefault()
  const main = ev.currentTarget
  const ph = main._placeholder
  if(!ph){
    document.querySelectorAll('.column').forEach(c=>c.classList.remove('drop-target'))
    return
  }
  const draggedId = dragState.columnId
  const draggedEl = document.querySelector('.column[data-id="'+draggedId+'"]')
  if(draggedEl){
    ph.parentNode.insertBefore(draggedEl, ph)
    const order = Array.from(document.querySelectorAll('.column')).map(x=>x.dataset.id)
    await reorderColumns(order)
  }
  clearPlaceholder()
  document.querySelectorAll('.column').forEach(c=>c.classList.remove('drop-target'))
  dragState = { type: null, columnId: null, cardId: null }
}

function clearPlaceholder(){
  const main = document.getElementById('board')
  if(main && main._placeholder){
    try{ main._placeholder.remove() }catch(e){}
    main._placeholder = null
  }
}

function fillColumnSelect(sel, state){
  sel.innerHTML='';
  state.columns.forEach(col => {
    const opt = document.createElement('option'); opt.value = col.id; opt.textContent = col.name; sel.appendChild(opt)
  })
}

function showIconPreview(url){
  const p = document.getElementById('iconPreview'); p.innerHTML=''; if(!url) return; const img = document.createElement('img'); img.src = url; p.appendChild(img)
}

async function load(){
  const state = await fetchState();
  render(state);
  // fill only modal column select (main page select removed)
  fillColumnSelect(document.querySelector('#modalForm select[name=column_id]'), state)
}

// Modal handling
const modal = document.getElementById('modal');
const modalForm = document.getElementById('modalForm');
const modalTitle = document.getElementById('modalTitle');
const deleteBtn = document.getElementById('deleteBtn');

document.getElementById('cancelBtn').addEventListener('click', closeModal)
document.getElementById('modalClose').addEventListener('click', closeModal)

function openModalForCard(card){
  modal.classList.remove('hidden')
  if(card){
    modalTitle.textContent = 'Edit card'
    modalForm.id.value = card.id
    modalForm.title.value = card.title
    modalForm.link.value = card.link || ''
    modalForm.description.value = card.description || ''
    modalForm.column_id.value = card.column_id
    modalForm.icon.value = card.icon || ''
    showIconPreview(card.icon)
    deleteBtn.style.display = 'inline-block'
  } else {
    modalTitle.textContent = 'Add card'
    modalForm.reset()
    modalForm.id.value = ''
    showIconPreview('')
    deleteBtn.style.display = 'none'
  }
}

function closeModal(){ modal.classList.add('hidden') }

// Show icon preview on URL input change
document.getElementById('modalForm').addEventListener('input', e=>{
  if(e.target.name === 'icon') showIconPreview(e.target.value)
})

modalForm.addEventListener('submit', async e=>{
  e.preventDefault();
  const f = e.target;
  const payload = { title: f.title.value, link: f.link.value, description: f.description.value, icon: f.icon.value, column_id: parseInt(f.column_id.value) }
  if(f.id.value){
    const res = await updateCard(f.id.value, payload)
    if(res.ok){ await load(); closeModal(); notifySuccess('Card updated') } else { notifyError('Failed to update card') }
  } else {
    const res = await createCard(payload)
    if(res.ok){ await load(); closeModal(); notifySuccess('Card created') } else { notifyError('Failed to create card') }
  }
})

deleteBtn.addEventListener('click', async ()=>{
  const id = modalForm.id.value; if(!id) return;
  const ok = await askConfirm('Delete this card?', { confirmLabel: 'Delete' })
  if(!ok) return;
  const res = await removeCard(id);
  if(res.status === 204){ await load(); closeModal(); notifySuccess('Card deleted') } else { notifyError('Failed to delete card') }
})

// main page column form removed; column management done via Settings modal

// Settings modal logic
const settingsModal = document.getElementById('settingsModal');
const settingsClose = document.getElementById('settingsClose');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const openSettings = document.getElementById('openSettings');
const columnsList = document.getElementById('columnsList');
const settingsAddCol = document.getElementById('settingsAddCol');
const resetTabCardFormBtn = document.getElementById('resetTabCardForm');

openSettings.addEventListener('click', async ()=>{
  settingsModal.classList.remove('hidden')
  const state = await fetchState()
  // Load current settings into form
  document.getElementById('settingsLayout').dashboard_title.value = settings.dashboard_title
  document.getElementById('settingsLayout').cols_per_row.value = settings.cols_per_row
  document.getElementById('settingsLayout').column_width.value = settings.column_width
  document.getElementById('settingsLayout').card_height.value = settings.card_height
  // color and opacity controls
  const colColor = document.getElementById('column_bg_color')
  const colOp = document.getElementById('column_bg_opacity')
  const colOpVal = document.getElementById('column_bg_opacity_val')
  const cardColor = document.getElementById('card_bg_color')
  const cardOp = document.getElementById('card_bg_opacity')
  const cardOpVal = document.getElementById('card_bg_opacity_val')
  if(colColor) colColor.value = settings.column_bg_color || '#ffffff'
  if(colOp){ colOp.value = Math.round((settings.column_bg_opacity || 1.0) * 100); colOpVal.textContent = colOp.value + '%' }
  if(cardColor) cardColor.value = settings.card_bg_color || '#ffffff'
  if(cardOp){ cardOp.value = Math.round((settings.card_bg_opacity || 1.0) * 100); cardOpVal.textContent = cardOp.value + '%' }
  // Fill column selects
  fillColumnSelect(document.querySelector('#modalForm select[name=column_id]'), state)
  fillColumnSelect(document.querySelector('#tabCardForm select[name=column_id]'), state)
  await refreshSettings()
})

// live update handlers for color/opacity controls
const colColorInput = document.getElementById('column_bg_color')
const colOpInput = document.getElementById('column_bg_opacity')
const colOpDisplay = document.getElementById('column_bg_opacity_val')
const cardColorInput = document.getElementById('card_bg_color')
const cardOpInput = document.getElementById('card_bg_opacity')
const cardOpDisplay = document.getElementById('card_bg_opacity_val')
if(colColorInput){ colColorInput.addEventListener('input', e=>{ settings.column_bg_color = e.target.value; applySettings() }) }
if(colOpInput){ colOpInput.addEventListener('input', e=>{ const v = parseInt(e.target.value||100); colOpDisplay.textContent = v + '%'; settings.column_bg_opacity = v/100; applySettings() }) }
if(cardColorInput){ cardColorInput.addEventListener('input', e=>{ settings.card_bg_color = e.target.value; applySettings() }) }
if(cardOpInput){ cardOpInput.addEventListener('input', e=>{ const v = parseInt(e.target.value||100); cardOpDisplay.textContent = v + '%'; settings.card_bg_opacity = v/100; applySettings() }) }

// handle background file uploads
const bgFileInput = document.getElementById('dashboard_bg_file')
if(bgFileInput){
  bgFileInput.addEventListener('change', async e=>{
    const file = e.target.files[0]
    if(!file) return
    try{
      const res = await uploadBackground(file)
      if(!res.ok) throw new Error('upload failed')
      await res.json()
      // set returned url into the image input so user can save settings
      // refresh settings from server (upload endpoint updates DB)
      await loadSettings()
      notifySuccess('Background uploaded and applied')
    }catch(err){
      notifyError('Failed to upload background image')
    }
  })
}
// Reset background button
const resetBgBtn = document.getElementById('resetBgBtn')
if(resetBgBtn){
  resetBgBtn.addEventListener('click', async ()=>{
    const ok = await askConfirm('Delete background image?', { confirmLabel: 'Delete' })
    if(!ok) return
    try{
      const res = await resetBackground()
      if(res.status === 204){
        await loadSettings()
        notifySuccess('Background reset')
      } else {
        notifyError('Failed to reset background')
      }
    }catch(e){
      notifyError('Failed to reset background')
    }
  })
}
settingsClose.addEventListener('click', ()=> settingsModal.classList.add('hidden'))
settingsCloseBtn.addEventListener('click', ()=> settingsModal.classList.add('hidden'))

document.getElementById('settingsLayout').addEventListener('submit', async e=>{
  e.preventDefault()
  const f = e.target
  const payload = {
    dashboard_title: f.dashboard_title.value || 'Start Dashboard',
    cols_per_row: parseInt(f.cols_per_row.value) || 3,
    column_width: parseInt(f.column_width.value) || 320,
    card_height: parseInt(f.card_height.value) || 0,
    column_bg_color: settings.column_bg_color || '#ffffff',
    column_bg_opacity: settings.column_bg_opacity || 1.0,
    card_bg_color: settings.card_bg_color || '#ffffff',
    card_bg_opacity: settings.card_bg_opacity || 1.0
  }
  try{
    const res = await saveSettings(payload)
    if(!res.ok) throw new Error('save failed')
    await loadSettings()
    notifySuccess('Settings saved')
  }catch(err){
    notifyError('Failed to save settings')
  }
})

async function refreshSettings(){
  const state = await fetchState();
  columnsList.innerHTML = '';
  state.columns.forEach(col => {
    const row = document.createElement('div'); row.className = 'col-item'
    const colname = document.createElement('div'); colname.className = 'col-name'; colname.textContent = col.name
    const actions = document.createElement('div'); actions.className = 'col-actions'
    const edit = document.createElement('button'); edit.className = 'edit-col'; edit.textContent = 'Edit';
    edit.addEventListener('click', async ()=>{
      const newName = prompt('New column name:', col.name)
      if(newName && newName.trim()){
        const res = await updateColumn(col.id, {name: newName.trim()})
        if(res.ok){ await load(); await refreshSettings(); notifySuccess('Column updated') } else notifyError('Failed to update column')
      }
    })
    const del = document.createElement('button'); del.textContent = 'Delete';
    del.addEventListener('click', async ()=>{
      const ok = await askConfirm('Delete this column and all its cards?', { confirmLabel: 'Delete' })
      if(!ok) return;
      const res = await removeColumn(col.id)
      if(res.status === 204) await load(), refreshSettings()
      else notifyError('Failed to delete column')
    })
    actions.appendChild(edit); actions.appendChild(del)
    row.appendChild(colname); row.appendChild(actions)
    columnsList.appendChild(row)
  })
}

settingsAddCol.addEventListener('submit', async e=>{
  e.preventDefault();
  const f = e.target; const res = await createColumn({name:f.name.value})
  if(res.ok){ f.reset(); await load(); await refreshSettings(); notifySuccess('Column added') } else notifyError('Failed to add column')
})

// Tab card form - add/edit cards from Settings
const tabCardForm = document.getElementById('tabCardForm');
tabCardForm.addEventListener('submit', async e=>{
  e.preventDefault();
  const f = e.target;
  const payload = { title: f.title.value, link: f.link.value, description: f.description.value, icon: f.icon.value, column_id: parseInt(f.column_id.value) }
  if(f.id.value){
    const res = await updateCard(f.id.value, payload)
    if(res.ok){ await load(); f.reset(); resetTabCardFormBtn.classList.add('is-hidden'); notifySuccess('Card updated') } else { notifyError('Failed to update card') }
  } else {
    const res = await createCard(payload)
    if(res.ok){ await load(); f.reset(); notifySuccess('Card added') } else { notifyError('Failed to create card') }
  }
})

resetTabCardFormBtn.addEventListener('click', ()=>{
  tabCardForm.reset()
  tabCardForm.id.value = ''
  resetTabCardFormBtn.classList.add('is-hidden')
})

// Tab switching logic
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', ()=>{
    const tabName = btn.dataset.tab
    // Hide all tabs, deactivate all buttons
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    // Show selected tab, activate button
    document.getElementById(tabName + '-tab').classList.add('active')
    btn.classList.add('active')
  })
})

// Load settings and initialize
loadSettings()
load()
