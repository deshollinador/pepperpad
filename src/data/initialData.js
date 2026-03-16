export const initialNotes = [
  {
    id: '1',
    templateType: 'simple',
    title: 'Mi primera nota',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    blocks: [
      {
        id: 'b1',
        title: 'Primer bloque',
        body: '',
        attributes: [],
        children: [],
        collapsed: true,
        order: 0
      }
    ]
  }
]