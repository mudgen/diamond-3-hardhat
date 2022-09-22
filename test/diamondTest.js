/* global describe it before ethers */

const {
  getSelectors,
  FacetCutAction,
  removeSelectors,
  findAddressPositionInFacets
} = require('../scripts/libraries/diamond.js')

const { deployDiamond } = require('../scripts/deploy.js')

const { assert } = require('chai')

describe('DiamondTest', async function () {
  let diamondAddress
  let diamondCutFacet
  let diamondLoupeFacet
  let ownershipFacet
  let tx
  let receipt
  let result
  const addresses = []

  before(async function () {
    diamondAddress = await deployDiamond()
    diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress)
    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress)
    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress)
  })

  it('should have three facets -- call to facetAddresses function', async () => {
    for (const address of await diamondLoupeFacet.facetAddresses()) {
      addresses.push(address)
    }

    assert.equal(addresses.length, 3)
  })

  it('facets should have the right function selectors -- call to facetFunctionSelectors function', async () => {
    let selectors = getSelectors(diamondCutFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[0])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(diamondLoupeFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[1])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(ownershipFacet)
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[2])
    assert.sameMembers(result, selectors)
  })

  it('selectors should be associated to facets correctly -- multiple calls to facetAddress function', async () => {
    assert.equal(
      addresses[0],
      await diamondLoupeFacet.facetAddress('0x1f931c1c')
    )
    assert.equal(
      addresses[1],
      await diamondLoupeFacet.facetAddress('0xcdffacc6')
    )
    assert.equal(
      addresses[1],
      await diamondLoupeFacet.facetAddress('0x01ffc9a7')
    )
    assert.equal(
      addresses[2],
      await diamondLoupeFacet.facetAddress('0xf2fde38b')
    )
  })

  it('should add test1 functions', async () => {
    const Test1Facet = await ethers.getContractFactory('Test1Facet')
    const test1Facet = await Test1Facet.deploy()
    await test1Facet.deployed()
    addresses.push(test1Facet.address)
    const selectors = getSelectors(test1Facet).remove(['supportsInterface(bytes4)'])
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: test1Facet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(test1Facet.address)
    assert.sameMembers(result, selectors)
  })

  it('should test function call', async () => {
    const test1Facet = await ethers.getContractAt('Test1Facet', diamondAddress)
    await test1Facet.test1Func10()
  })

  it('should replace supportsInterface function', async () => {
    const Test1Facet = await ethers.getContractFactory('Test1Facet')
    const selectors = getSelectors(Test1Facet).get(['supportsInterface(bytes4)'])
    const testFacetAddress = addresses[3]
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: testFacetAddress,
        action: FacetCutAction.Replace,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(testFacetAddress)
    assert.sameMembers(result, getSelectors(Test1Facet))
  })

  it('should add test2 functions', async () => {
    const Test2Facet = await ethers.getContractFactory('Test2Facet')
    const test2Facet = await Test2Facet.deploy()
    await test2Facet.deployed()
    addresses.push(test2Facet.address)
    const selectors = getSelectors(test2Facet)
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: test2Facet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(test2Facet.address)
    assert.sameMembers(result, selectors)
  })

  it('should remove some test2 functions', async () => {
    const test2Facet = await ethers.getContractAt('Test2Facet', diamondAddress)
    const functionsToKeep = ['test2Func1()', 'test2Func5()', 'test2Func6()', 'test2Func19()', 'test2Func20()']
    const selectors = getSelectors(test2Facet).remove(functionsToKeep)
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[4])
    assert.sameMembers(result, getSelectors(test2Facet).get(functionsToKeep))
  })

  it('should remove some test1 functions', async () => {
    const test1Facet = await ethers.getContractAt('Test1Facet', diamondAddress)
    const functionsToKeep = ['test1Func2()', 'test1Func11()', 'test1Func12()']
    const selectors = getSelectors(test1Facet).remove(functionsToKeep)
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3])
    assert.sameMembers(result, getSelectors(test1Facet).get(functionsToKeep))
  })

  it('remove all functions and facets except \'diamondCut\' and \'facets\'', async () => {
    let selectors = []
    let facets = await diamondLoupeFacet.facets()
    for (let i = 0; i < facets.length; i++) {
      selectors.push(...facets[i].functionSelectors)
    }
    selectors = removeSelectors(selectors, ['facets()', 'diamondCut(tuple(address,uint8,bytes4[])[],address,bytes)'])
    tx = await diamondCutFacet.diamondCut(
      [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    facets = await diamondLoupeFacet.facets()
    assert.equal(facets.length, 2)
    assert.equal(facets[0][0], addresses[0])
    assert.sameMembers(facets[0][1], ['0x1f931c1c'])
    assert.equal(facets[1][0], addresses[1])
    assert.sameMembers(facets[1][1], ['0x7a0ed627'])
  })

  it('add most functions and facets', async () => {
    const diamondLoupeFacetSelectors = getSelectors(diamondLoupeFacet).remove(['supportsInterface(bytes4)'])
    const Test1Facet = await ethers.getContractFactory('Test1Facet')
    const Test2Facet = await ethers.getContractFactory('Test2Facet')
    // Any number of functions from any number of facets can be added/replaced/removed in a
    // single transaction
    const cut = [
      {
        facetAddress: addresses[1],
        action: FacetCutAction.Add,
        functionSelectors: diamondLoupeFacetSelectors.remove(['facets()'])
      },
      {
        facetAddress: addresses[2],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(ownershipFacet)
      },
      {
        facetAddress: addresses[3],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(Test1Facet)
      },
      {
        facetAddress: addresses[4],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(Test2Facet)
      }
    ]
    tx = await diamondCutFacet.diamondCut(cut, ethers.constants.AddressZero, '0x', { gasLimit: 8000000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    const facets = await diamondLoupeFacet.facets()
    const facetAddresses = await diamondLoupeFacet.facetAddresses()
    assert.equal(facetAddresses.length, 5)
    assert.equal(facets.length, 5)
    assert.sameMembers(facetAddresses, addresses)
    assert.equal(facets[0][0], facetAddresses[0], 'first facet')
    assert.equal(facets[1][0], facetAddresses[1], 'second facet')
    assert.equal(facets[2][0], facetAddresses[2], 'third facet')
    assert.equal(facets[3][0], facetAddresses[3], 'fourth facet')
    assert.equal(facets[4][0], facetAddresses[4], 'fifth facet')
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[0], facets)][1], getSelectors(diamondCutFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[1], facets)][1], diamondLoupeFacetSelectors)
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[2], facets)][1], getSelectors(ownershipFacet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[3], facets)][1], getSelectors(Test1Facet))
    assert.sameMembers(facets[findAddressPositionInFacets(addresses[4], facets)][1], getSelectors(Test2Facet))
  })
})

/*

Cache bug test
DiamondCutFacet deployed: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Diamond deployed: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
DiamondInit deployed: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

Deploying facets
DiamondLoupeFacet deployed: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
OwnershipFacet deployed: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9

Diamond Cut: [
  {
    facetAddress: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    action: 0,
    functionSelectors: [
      '0xcdffacc6',
      '0x52ef6b2c',
      '0xadfca15e',
      '0x7a0ed627',
      '0x01ffc9a7',
      contract: [Contract],
      remove: [Function: remove],
      get: [Function: get]
    ]
  },
  {
    facetAddress: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    action: 0,
    functionSelectors: [
      '0x8da5cb5b',
      '0xf2fde38b',
      contract: [Contract],
      remove: [Function: remove],
      get: [Function: get]
    ]
  }
]
Diamond cut tx:  0xcb102437ddd71a4c98d8fc4e20c9ed136930cc277518dce24f843c82ab19d748
Completed diamond cut
    ✓ should not exhibit the cache bug (51ms)

  DiamondTest
DiamondCutFacet deployed: 0x8A791620dd6260079BF849Dc5567aDC3F2FdC318
Diamond deployed: 0x610178dA211FEF7D417bC0e6FeD39F05609AD788
DiamondInit deployed: 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e

Deploying facets
DiamondLoupeFacet deployed: 0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0
OwnershipFacet deployed: 0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82

Diamond Cut: [
  {
    facetAddress: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
    action: 0,
    functionSelectors: [
      '0xcdffacc6',
      '0x52ef6b2c',
      '0xadfca15e',
      '0x7a0ed627',
      '0x01ffc9a7',
      contract: [Contract],
      remove: [Function: remove],
      get: [Function: get]
    ]
  },
  {
    facetAddress: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
    action: 0,
    functionSelectors: [
      '0x8da5cb5b',
      '0xf2fde38b',
      contract: [Contract],
      remove: [Function: remove],
      get: [Function: get]
    ]
  }
]
Diamond cut tx:  0xf227fd54006121eaf37e2df945891462a063572fcc930f4c37e795a440d02d59
Completed diamond cut
    ✓ should have three facets -- call to facetAddresses function
    ✓ facets should have the right function selectors -- call to facetFunctionSelectors function (105ms)
    ✓ selectors should be associated to facets correctly -- multiple calls to facetAddress function (99ms)
    ✓ should add test1 functions (573ms)
    ✓ should test function call (111ms)
    ✓ should replace supportsInterface function (253ms)
    ✓ should add test2 functions (636ms)
    ✓ should remove some test2 functions (491ms)
    ✓ should remove some test1 functions (611ms)
    ✓ remove all functions and facets except 'diamondCut' and 'facets' (472ms)
    ✓ add most functions and facets (1002ms)


*/

/*

DiamondCutFacet deployed: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Diamond deployed: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
DiamondInit deployed: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

Deploying facets
DiamondLoupeFacet deployed: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
OwnershipFacet deployed: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9

Diamond Cut: [
  {
    facetAddress: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    action: 0,
    functionSelectors: [
      '0xcdffacc6',
      '0x52ef6b2c',
      '0xadfca15e',
      '0x7a0ed627',
      '0x01ffc9a7',
      contract: [Contract],
      remove: [Function: remove],
      get: [Function: get]
    ]
  },
  {
    facetAddress: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    action: 0,
    functionSelectors: [
      '0x8da5cb5b',
      '0xf2fde38b',
      contract: [Contract],
      remove: [Function: remove],
      get: [Function: get]
    ]
  }
]
Diamond cut tx:  0xcb102437ddd71a4c98d8fc4e20c9ed136930cc277518dce24f843c82ab19d748
Completed diamond cut

*/
