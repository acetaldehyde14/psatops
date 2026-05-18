package com.psap.palletisation.repository;

import com.psap.palletisation.entity.SkuMasterEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

public interface SkuMasterRepository extends JpaRepository<SkuMasterEntity, Long> {
    Optional<SkuMasterEntity> findByOrgIdAndSkuId(String orgId, String skuId);
    List<SkuMasterEntity> findByOrgId(String orgId);

    @Transactional
    void deleteByOrgIdAndSkuId(String orgId, String skuId);

    boolean existsByOrgIdAndSkuId(String orgId, String skuId);
}
