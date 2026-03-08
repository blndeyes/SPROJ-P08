const express = require('express')
const { requireAuth, requireRole } = require('../middleware/auth')
const Field = require('../models/Field')
const Diagnosis = require('../models/Diagnosis')

const router = express.Router()

function health_from_diagnosis(d) {
  if (!d) return { health: null, status: 'unknown' }
  const label = (d.diagnosis || '').toLowerCase()
  const conf = typeof d.confidence === 'number' ? d.confidence : 0
  const is_healthy = label.includes('healthy') || label === 'normal'
  const health = is_healthy ? 100 : Math.max(0, Math.round(100 - conf * 100))
  const status = health >= 70 ? 'healthy' : health >= 40 ? 'attention' : 'issue'
  return { health, status }
}

router.get('/', requireAuth, requireRole(['farmer']), async function (req, res) {
  try {
    const fields = await Field.find({ user_id: req.auth.userId })
      .sort({ updated_at: -1, _id: -1 })
      .lean()

    const with_health = await Promise.all(
      fields.map(async (f) => {
        const latest = await Diagnosis.findOne({ field_id: f._id })
          .sort({ created_at: -1 })
          .select('diagnosis confidence created_at')
          .lean()
        const { health, status } = health_from_diagnosis(latest)
        return {
          ...f,
          health: health ?? undefined,
          status: status
        }
      })
    )

    res.json({ fields: with_health })
  } catch (err) {
    console.error('Fields list error:', err.message || err)
    res.status(500).json({ message: 'Failed to load fields' })
  }
})

router.post('/', requireAuth, requireRole(['farmer']), async function (req, res) {
  try {
    const { name, area, location, wheat_variety, sowing_date } = req.body || {}
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ message: 'Field name is required' })
      return
    }
    const field = new Field({
      user_id: req.auth.userId,
      name: (name || '').trim(),
      area: (area || '').trim(),
      location: (location || '').trim(),
      wheat_variety: (wheat_variety || '').trim(),
      sowing_date: (sowing_date || '').trim()
    })
    await field.save()
    res.status(201).json(field)
  } catch (err) {
    console.error('Field create error:', err.message || err)
    res.status(500).json({ message: 'Failed to create field' })
  }
})

router.get('/:id', requireAuth, requireRole(['farmer']), async function (req, res) {
  try {
    const field = await Field.findOne({
      _id: req.params.id,
      user_id: req.auth.userId
    }).lean()
    if (!field) {
      res.status(404).json({ message: 'Field not found' })
      return
    }
    const latest = await Diagnosis.findOne({ field_id: field._id })
      .sort({ created_at: -1 })
      .lean()
    const { health, status } = health_from_diagnosis(latest)
    res.json({ ...field, health: health ?? undefined, status })
  } catch (err) {
    console.error('Field get error:', err.message || err)
    res.status(500).json({ message: 'Failed to load field' })
  }
})

router.put('/:id', requireAuth, requireRole(['farmer']), async function (req, res) {
  try {
    const field = await Field.findOne({
      _id: req.params.id,
      user_id: req.auth.userId
    })
    if (!field) {
      res.status(404).json({ message: 'Field not found' })
      return
    }
    const { name, area, location, wheat_variety, sowing_date } = req.body || {}
    if (name !== undefined) field.name = String(name).trim()
    if (area !== undefined) field.area = String(area).trim()
    if (location !== undefined) field.location = String(location).trim()
    if (wheat_variety !== undefined) field.wheat_variety = String(wheat_variety).trim()
    if (sowing_date !== undefined) field.sowing_date = String(sowing_date).trim()
    field.updated_at = new Date()
    await field.save()
    res.json(field)
  } catch (err) {
    console.error('Field update error:', err.message || err)
    res.status(500).json({ message: 'Failed to update field' })
  }
})

router.delete('/:id', requireAuth, requireRole(['farmer']), async function (req, res) {
  try {
    const field = await Field.findOneAndDelete({
      _id: req.params.id,
      user_id: req.auth.userId
    })
    if (!field) {
      res.status(404).json({ message: 'Field not found' })
      return
    }
    await Diagnosis.updateMany(
      { field_id: field._id },
      { $unset: { field_id: 1 } }
    )
    res.status(204).send()
  } catch (err) {
    console.error('Field delete error:', err.message || err)
    res.status(500).json({ message: 'Failed to delete field' })
  }
})

module.exports = router
